import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { groq } from "@/lib/groq";
import { bodyToHtml } from "@/lib/emailGenerator";
import { transporter } from "@/lib/mailer";
import { CLIENT_CONFIG } from "@/lib/config";
import type { Lead, LeadResearch } from "@/types/database";

export const maxDuration = 60;

// ── Meeting request email generation ─────────────────────────────────────────

async function generateMeetingEmail(
  lead: { name: string; company: string; title: string },
  research: LeadResearch | null,
  meetingLink: string,
): Promise<{ subject: string; body: string }> {
  const firstName   = lead.name.split(" ")[0];
  const contextLine = research?.company_summary
    ? `Company context: ${research.company_summary}`
    : "";
  const painLine = research?.pain_points
    ? `Key challenge I noticed: ${research.pain_points}`
    : "";
  const angleLine = research?.best_outreach_angle
    ? `Angle: ${research.best_outreach_angle}`
    : "";

  const prompt = `Write a short, personalized meeting request email for ${lead.name} (${lead.title} at ${lead.company}).

${contextLine}
${painLine}
${angleLine}

Rules:
- Subject must be exactly: "Quick 15-min call, ${firstName}?"
- Opening: 1 sentence referencing something specific about their company or role
- Value prop: 1–2 sentences on what we do and why it's relevant to them specifically
- Calendly CTA: naturally include this booking link on its own line: ${meetingLink}
- Closing: Casual, warm — "Looking forward to connecting" style
- Total body: 4–5 sentences max
- Tone: Peer-to-peer, not salesy

Return ONLY JSON: {"subject":"Quick 15-min call, ${firstName}?","body":"..."}`;

  try {
    const completion = await groq.chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{ role: "user", content: prompt }],
      temperature:     0.65,
      max_tokens:      600,
      response_format: { type: "json_object" },
    });
    const p = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    if (p.body?.trim()) {
      return {
        subject: `Quick 15-min call, ${firstName}?`,
        body:    p.body.trim(),
      };
    }
  } catch (err) {
    console.error("[meeting-booker] Groq failed:", err instanceof Error ? err.message : err);
  }

  // Fallback
  const fallbackBody = `Hi ${firstName},\n\nI came across ${lead.company} and wanted to reach out — I think what we're building could be really relevant to what you're working on as ${lead.title}.\n\nI'd love to grab 15 minutes to share what we've been doing and hear a bit about your current priorities. No pitch, just a quick conversation.\n\n👉 Book a time here: ${meetingLink}\n\nLooking forward to connecting!`;
  return { subject: `Quick 15-min call, ${firstName}?`, body: fallbackBody };
}

// ── Process a single lead ─────────────────────────────────────────────────────

async function bookMeetingForLead(
  lead:        Lead,
  userId:      string,
  meetingLink: string,
  supabase:    ReturnType<typeof createAdminClient>,
  appUrl:      string,
): Promise<{ leadId: string; name: string; emailSent: boolean; skipped: boolean; skipReason?: string }> {
  if (!lead.email || !lead.email.includes("@") || lead.email === "unknown@unknown.com") {
    return { leadId: lead.id, name: lead.name, emailSent: false, skipped: true, skipReason: "no valid email" };
  }

  const research  = (lead.research as LeadResearch | null) ?? null;
  const generated = await generateMeetingEmail(
    { name: lead.name, company: lead.company ?? "", title: lead.title ?? "" },
    research,
    meetingLink,
  );

  const tracking_id = randomUUID();
  const html         = bodyToHtml(
    generated.body,
    `${appUrl}/api/outreach/track?id=${tracking_id}`,
  );

  let smtpOk = false;
  try {
    await transporter.sendMail({
      from:    `"${process.env.SMTP_FROM_NAME ?? CLIENT_CONFIG.companyName}" <${process.env.SMTP_USER}>`,
      to:      lead.email,
      subject: generated.subject,
      text:    generated.body,
      html,
    });
    smtpOk = true;
  } catch (err) {
    console.error("[meeting-booker] SMTP failed for", lead.email, err instanceof Error ? err.message : err);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.from("outreach_emails").insert({
    user_id:       userId,
    lead_id:       lead.id,
    campaign_id:   null,
    sequence_day:  null,
    subject:       generated.subject,
    body:          generated.body,
    html,
    status:        smtpOk ? "sent" : "failed",
    tracking_id,
    scheduled_for: new Date().toISOString(),
    sent_at:       smtpOk ? new Date().toISOString() : null,
  } as any);

  return { leadId: lead.id, name: lead.name, emailSent: smtpOk, skipped: false };
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { leadId?: string; calendlyLink?: string; runAll?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const meetingLink = body.calendlyLink?.trim() || CLIENT_CONFIG.calendlyLink;
  const supabase    = createAdminClient();
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // ── runAll: book meetings with all hot leads not contacted in 7 days ─────────
  if (body.runAll) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const [hotLeadsRes, recentContactRes] = await Promise.all([
      supabase
        .from("leads")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "hot")
        .gte("score", 50)
        .order("score", { ascending: false })
        .limit(20),
      supabase
        .from("outreach_emails")
        .select("lead_id")
        .eq("user_id", user.id)
        .gte("created_at", sevenDaysAgo),
    ]);

    const recentLeadIds = new Set((recentContactRes.data ?? []).map((e) => e.lead_id));
    const eligible      = ((hotLeadsRes.data as Lead[]) ?? []).filter(
      (l) => !recentLeadIds.has(l.id),
    );

    if (eligible.length === 0) {
      return NextResponse.json({
        processed: 0, emailsSent: 0, skipped: 0,
        message: "No eligible hot leads — all were contacted within the last 7 days",
        meetingLink,
      });
    }

    console.log("[meeting-booker] runAll — processing", eligible.length, "leads");

    const results = [];
    for (const lead of eligible) {
      try {
        const r = await bookMeetingForLead(lead, user.id, meetingLink, supabase, appUrl);
        results.push(r);
      } catch (err) {
        console.error("[meeting-booker] Error on lead", lead.id, err);
        results.push({ leadId: lead.id, name: lead.name, emailSent: false, skipped: true, skipReason: "unexpected error" });
      }
    }

    return NextResponse.json({
      processed:  results.filter((r) => !r.skipped).length,
      emailsSent: results.filter((r) => r.emailSent).length,
      skipped:    results.filter((r) => r.skipped).length,
      meetingLink,
      details:    results,
    });
  }

  // ── Single lead mode ──────────────────────────────────────────────────────────
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId or runAll:true required" }, { status: 400 });
  }

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", body.leadId)
    .eq("user_id", user.id)
    .single();

  if (leadErr || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const result = await bookMeetingForLead(lead as Lead, user.id, meetingLink, supabase, appUrl);

  return NextResponse.json({
    success:     result.emailSent,
    emailSent:   result.emailSent,
    skipped:     result.skipped,
    skipReason:  result.skipReason,
    meetingLink,
  });
}

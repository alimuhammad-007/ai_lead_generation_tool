import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { groq } from "@/lib/groq";
import { generateEmail, bodyToHtml } from "@/lib/emailGenerator";
import { transporter } from "@/lib/mailer";
import type { Lead, LeadResearch } from "@/types/database";

export const maxDuration = 60;

// ── Email generation (with research talking points) ───────────────────────────

async function generateResearchEmail(
  lead: { name: string; company: string; title: string },
  research: LeadResearch,
): Promise<{ subject: string; body: string }> {
  const talkingPoints = research.talking_points.length
    ? research.talking_points.map((p, i) => `${i + 1}. ${p}`).join("\n")
    : research.best_outreach_angle;

  const prompt = `Write a cold outreach email for ${lead.name} (${lead.title} at ${lead.company}).

Use these research-based talking points naturally in the email body:
${talkingPoints}

Context:
- Company overview: ${research.company_summary}
- Key pain point: ${research.pain_points}
- Best angle: ${research.best_outreach_angle}

Rules:
- Subject line: use the best angle, under 60 chars
- Body: 3 short paragraphs — hook using a talking point, value bridge, soft CTA
- Tone: professional and warm, never "I hope this email finds you well"
- CTA: invite a quick 15-min call, no pressure

Return ONLY JSON: {"subject":"...","body":"..."}`;

  try {
    const completion = await groq.chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{ role: "user", content: prompt }],
      temperature:     0.6,
      max_tokens:      1024,
      response_format: { type: "json_object" },
    });
    const p = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    if (p.subject?.trim() && p.body?.trim()) return { subject: p.subject, body: p.body };
  } catch { /* fall through to standard generator */ }

  return generateEmail({
    name: lead.name, company: lead.company, title: lead.title, angle: "introduction",
  });
}

// ── LinkedIn message generation ────────────────────────────────────────────────

async function generateLinkedInMessage(
  lead: { name: string; company: string | null; title: string | null },
  research: LeadResearch | null,
): Promise<string> {
  const hook = research?.best_outreach_angle
    ? `Angle: ${research.best_outreach_angle}`
    : "";

  try {
    const completion = await groq.chat.completions.create({
      model:       "llama-3.3-70b-versatile",
      messages:    [{
        role:    "user",
        content: `Write a LinkedIn connection request note for ${lead.name}, ${lead.title ?? "professional"} at ${lead.company ?? "their company"}. ${hook} Max 300 chars. Direct, no "Hi [Name]" placeholder, no fluff. Return ONLY the message text.`,
      }],
      temperature: 0.65,
      max_tokens:  150,
    });
    return (completion.choices[0]?.message?.content?.trim() ?? "").slice(0, 300);
  } catch { return ""; }
}

// ── WhatsApp message generation ────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 ? "1" + digits : digits;
}

async function generateWhatsAppMessage(
  lead: { name: string; company: string | null; title: string | null; phone: string },
  research: LeadResearch | null,
): Promise<{ message: string; waLink: string }> {
  const hook = research?.best_outreach_angle
    ? `Use this hook: "${research.best_outreach_angle}".`
    : "";

  try {
    const completion = await groq.chat.completions.create({
      model:       "llama-3.3-70b-versatile",
      messages:    [{
        role:    "user",
        content: `Write a WhatsApp intro message for ${lead.name}, ${lead.title ?? "professional"} at ${lead.company ?? "their company"}. AI automation agency outreach. ${hook} Max 400 chars. Casual tone, 1–2 emojis, soft question at end. No placeholders. Return ONLY the message.`,
      }],
      temperature: 0.75,
      max_tokens:  200,
    });
    const message = (completion.choices[0]?.message?.content?.trim() ?? "").slice(0, 400);
    const waLink  = `https://wa.me/${normalizePhone(lead.phone)}?text=${encodeURIComponent(message)}`;
    return { message, waLink };
  } catch { return { message: "", waLink: "" }; }
}

// ── Single-lead outreach ───────────────────────────────────────────────────────

type ChannelResult = {
  leadId:          string;
  name:            string;
  skipped:         boolean;
  skipReason?:     string;
  emailSent:       boolean;
  linkedinMessage: string | null;
  whatsappMessage: string | null;
  whatsappLink:    string | null;
  skippedChannels: string[];
};

async function outreachOneLead(
  lead:     Lead,
  channels: string[],
  userId:   string,
  supabase: ReturnType<typeof createAdminClient>,
  appUrl:   string,
): Promise<ChannelResult> {
  const result: ChannelResult = {
    leadId:          lead.id,
    name:            lead.name,
    skipped:         false,
    emailSent:       false,
    linkedinMessage: null,
    whatsappMessage: null,
    whatsappLink:    null,
    skippedChannels: [],
  };

  // ── Score gate: check existing score, never auto-score ────────────────────
  if ((lead.score ?? 0) < 50) {
    return {
      ...result,
      skipped:    true,
      skipReason: `Score ${lead.score ?? 0} is below 50 — skipped to avoid cold outreach`,
    };
  }

  const research = (lead.research as LeadResearch | null) ?? null;

  // ── Email channel ─────────────────────────────────────────────────────────
  if (channels.includes("email")) {
    const hasRealEmail =
      lead.email &&
      lead.email !== "unknown@unknown.com" &&
      lead.email.includes("@");

    if (!hasRealEmail) {
      result.skippedChannels.push("email: no valid email address");
    } else {
      try {
        const generated = research
          ? await generateResearchEmail(
              { name: lead.name, company: lead.company ?? "", title: lead.title ?? "" },
              research,
            )
          : await generateEmail({
              name: lead.name, company: lead.company ?? "", title: lead.title ?? "", angle: "introduction",
            });

        const tracking_id  = randomUUID();
        const scheduledFor = new Date().toISOString();
        const html         = bodyToHtml(generated.body, `${appUrl}/api/outreach/track?id=${tracking_id}`);

        let smtpOk = false;
        try {
          await transporter.sendMail({
            from:    `"${process.env.SMTP_FROM_NAME ?? "Apex Lead Gen"}" <${process.env.SMTP_USER}>`,
            to:      lead.email!,
            subject: generated.subject,
            text:    generated.body,
            html,
          });
          smtpOk = true;
        } catch (err) {
          console.error("[auto-outreach] SMTP failed for", lead.email, err instanceof Error ? err.message : err);
          result.skippedChannels.push(`email: SMTP failed`);
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
          scheduled_for: scheduledFor,
          sent_at:       smtpOk ? new Date().toISOString() : null,
        } as any);

        result.emailSent = smtpOk;
      } catch (err) {
        console.error("[auto-outreach] Email generation failed:", err instanceof Error ? err.message : err);
        result.skippedChannels.push("email: generation failed");
      }
    }
  }

  // ── LinkedIn channel ──────────────────────────────────────────────────────
  if (channels.includes("linkedin")) {
    if (!lead.linkedin_url) {
      result.skippedChannels.push("linkedin: no LinkedIn URL on record");
    } else {
      const msg = await generateLinkedInMessage(
        { name: lead.name, company: lead.company, title: lead.title },
        research,
      );
      if (msg) result.linkedinMessage = msg;
      else result.skippedChannels.push("linkedin: generation failed");
    }
  }

  // ── WhatsApp channel ──────────────────────────────────────────────────────
  if (channels.includes("whatsapp")) {
    if (!lead.phone) {
      result.skippedChannels.push("whatsapp: no phone number on record");
    } else {
      const wa = await generateWhatsAppMessage(
        { name: lead.name, company: lead.company, title: lead.title, phone: lead.phone },
        research,
      );
      if (wa.message) {
        result.whatsappMessage = wa.message;
        result.whatsappLink    = wa.waLink;
      } else {
        result.skippedChannels.push("whatsapp: generation failed");
      }
    }
  }

  return result;
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { leadId?: string; channels?: string[]; runAll?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const channels = Array.isArray(body.channels) ? body.channels : ["email", "linkedin", "whatsapp"];
  const supabase = createAdminClient();
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // ── runAll mode: batch outreach for all hot leads ─────────────────────────
  if (body.runAll) {
    const { data: hotLeads } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "hot")
      .gte("score", 50)
      .order("score", { ascending: false })
      .limit(15); // cap per run to stay within maxDuration

    const leads = (hotLeads as Lead[]) ?? [];

    if (leads.length === 0) {
      return NextResponse.json({
        processed:        0,
        skipped:          0,
        emailsSent:       0,
        linkedinMessages: 0,
        whatsAppMessages: 0,
        message:          "No hot leads with score ≥ 50 found",
        details:          [],
      });
    }

    console.log("[auto-outreach] runAll — processing", leads.length, "hot leads");

    const details: ChannelResult[] = [];
    for (const lead of leads) {
      try {
        const r = await outreachOneLead(lead, channels, user.id, supabase, appUrl);
        details.push(r);
      } catch (err) {
        console.error("[auto-outreach] Error on lead", lead.id, err);
        details.push({
          leadId: lead.id, name: lead.name, skipped: true,
          skipReason: "Unexpected error", emailSent: false,
          linkedinMessage: null, whatsappMessage: null, whatsappLink: null,
          skippedChannels: ["all: unexpected error"],
        });
      }
    }

    return NextResponse.json({
      processed:        details.filter((d) => !d.skipped).length,
      skipped:          details.filter((d) => d.skipped).length,
      emailsSent:       details.filter((d) => d.emailSent).length,
      linkedinMessages: details.filter((d) => !!d.linkedinMessage).length,
      whatsAppMessages: details.filter((d) => !!d.whatsappMessage).length,
      details,
    });
  }

  // ── Single lead mode ──────────────────────────────────────────────────────
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

  const result = await outreachOneLead(lead as Lead, channels, user.id, supabase, appUrl);

  return NextResponse.json({
    success:         !result.skipped && (result.emailSent || !!result.linkedinMessage || !!result.whatsappMessage),
    skipped:         result.skipped,
    skipReason:      result.skipReason,
    emailSent:       result.emailSent,
    linkedinMessage: result.linkedinMessage,
    whatsappMessage: result.whatsappMessage,
    whatsappLink:    result.whatsappLink,
    skippedChannels: result.skippedChannels,
    score:           (lead as Lead).score,
  });
}

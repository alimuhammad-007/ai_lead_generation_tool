import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { groq } from "@/lib/groq";
import { bodyToHtml } from "@/lib/emailGenerator";
import { transporter } from "@/lib/mailer";
import { CLIENT_CONFIG } from "@/lib/config";
import type { LeadResearch } from "@/types/database";

export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingFollowUp {
  leadId:          string;
  name:            string;
  email:           string;
  company:         string | null;
  title:           string | null;
  score:           number;
  research:        LeadResearch | null;
  originalSubject: string;
  daysSinceSent:   number;
  emailCount:      number;
}

// ── Find leads needing follow-up ─────────────────────────────────────────────

async function findFollowUpLeads(
  userId:  string,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<PendingFollowUp[]> {
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();

  // 1 — Emails sent 3+ days ago, not yet replied, ordered most-recent first
  const { data: staleEmails } = await supabase
    .from("outreach_emails")
    .select("lead_id, id, sent_at, subject, status")
    .eq("user_id", userId)
    .in("status", ["sent", "opened"])
    .lte("sent_at", threeDaysAgo)
    .order("sent_at", { ascending: false });

  if (!staleEmails || staleEmails.length === 0) return [];

  // 2 — Deduplicate: keep the most-recent stale email per lead
  const byLeadId = new Map<string, (typeof staleEmails)[number]>();
  for (const email of staleEmails) {
    if (!byLeadId.has(email.lead_id)) byLeadId.set(email.lead_id, email);
  }

  const candidateLeadIds = Array.from(byLeadId.keys());
  if (candidateLeadIds.length === 0) return [];

  // 3 — Parallel: get replied lead IDs + scheduled lead IDs + lead count per lead
  const [repliedRes, scheduledRes, countRes] = await Promise.all([
    supabase
      .from("outreach_emails")
      .select("lead_id")
      .eq("user_id", userId)
      .eq("status", "replied")
      .in("lead_id", candidateLeadIds),
    supabase
      .from("outreach_emails")
      .select("lead_id")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .in("lead_id", candidateLeadIds),
    supabase
      .from("outreach_emails")
      .select("lead_id")
      .eq("user_id", userId)
      .in("lead_id", candidateLeadIds),
  ]);

  const repliedIds   = new Set((repliedRes.data   ?? []).map((r) => r.lead_id));
  const scheduledIds = new Set((scheduledRes.data ?? []).map((r) => r.lead_id));

  // Count emails per lead
  const emailCounts = new Map<string, number>();
  for (const row of countRes.data ?? []) {
    emailCounts.set(row.lead_id, (emailCounts.get(row.lead_id) ?? 0) + 1);
  }

  // 4 — Filter to only truly unresponsive leads (no reply, no active sequence)
  const qualifyingIds = candidateLeadIds.filter(
    (id) => !repliedIds.has(id) && !scheduledIds.has(id),
  );

  if (qualifyingIds.length === 0) return [];

  // 5 — Fetch lead data
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, email, company, title, score, research")
    .eq("user_id", userId)
    .in("id", qualifyingIds.slice(0, 20));

  if (!leads) return [];

  const now = Date.now();
  return leads
    .filter((l) => l.email && l.email.includes("@"))
    .map((l) => {
      const stale         = byLeadId.get(l.id)!;
      const sentMs        = stale.sent_at ? new Date(stale.sent_at).getTime() : now - 4 * 86_400_000;
      const daysSinceSent = Math.floor((now - sentMs) / 86_400_000);
      return {
        leadId:          l.id,
        name:            l.name,
        email:           l.email!,
        company:         l.company,
        title:           l.title,
        score:           l.score,
        research:        (l.research as LeadResearch | null) ?? null,
        originalSubject: stale.subject ?? "",
        daysSinceSent,
        emailCount:      emailCounts.get(l.id) ?? 1,
      };
    });
}

// ── Follow-up email generation ────────────────────────────────────────────────

type FollowUpAngle = "value" | "social_proof" | "breakup";

function pickAngle(emailCount: number): FollowUpAngle {
  if (emailCount <= 1) return "value";
  if (emailCount === 2) return "social_proof";
  return "breakup";
}

async function generateFollowUpEmail(
  lead: { name: string; company: string | null; title: string | null },
  originalSubject: string,
  angle: FollowUpAngle,
  research: LeadResearch | null,
): Promise<{ subject: string; body: string }> {
  const firstName  = lead.name.split(" ")[0];
  const angleGuide =
    angle === "value"
      ? "Share a new insight, stat, or value angle not in the first email. Offer something tangible (a quick audit, a relevant case study, a specific idea for their company)."
      : angle === "social_proof"
      ? "Briefly mention a result you achieved for a similar company. Name the category of client (not the specific name), the outcome, and why it's relevant to them."
      : "This is a final gentle bump. Acknowledge you've reached out before and offer to close the loop. No pressure — just ask if timing is off or interest has changed. One sentence CTA.";

  const researchLine = research?.best_outreach_angle
    ? `Outreach angle to use: ${research.best_outreach_angle}`
    : "";

  const prompt = `Write a short follow-up email to ${lead.name} (${lead.title ?? "professional"} at ${lead.company ?? "their company"}).

They received an earlier email with subject: "${originalSubject}" — they haven't replied.

Follow-up angle: ${angleGuide}
${researchLine}

Rules:
- Subject: "Re: ${originalSubject}" OR a fresh, compelling subject if it fits the angle better
- Body: 2–3 sentences ONLY — brief acknowledgment, new value, one soft CTA
- Never guilt-trip about no reply
- Address them as ${firstName}
- Tone: Calm, confident, not desperate

Return ONLY JSON: {"subject":"...","body":"..."}`;

  try {
    const completion = await groq.chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{ role: "user", content: prompt }],
      temperature:     0.6,
      max_tokens:      512,
      response_format: { type: "json_object" },
    });
    const p = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    if (p.subject?.trim() && p.body?.trim()) return { subject: p.subject, body: p.body };
  } catch (err) {
    console.error("[followup] Groq failed:", err instanceof Error ? err.message : err);
  }

  // Fallback
  return {
    subject: `Re: ${originalSubject}`,
    body:    `Hi ${firstName},\n\nJust wanted to bump this up in case it got buried. Happy to share a quick idea specific to ${lead.company ?? "your company"} — no commitment needed.\n\nWould a 15-min call this week work?`,
  };
}

// ── GET — return leads needing follow-up ──────────────────────────────────────

export async function GET() {
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createAdminClient();
  const pending  = await findFollowUpLeads(user.id, supabase);

  return NextResponse.json({
    count: pending.length,
    leads: pending.map((p) => ({
      leadId:          p.leadId,
      name:            p.name,
      company:         p.company,
      title:           p.title,
      score:           p.score,
      daysSinceSent:   p.daysSinceSent,
      emailCount:      p.emailCount,
      originalSubject: p.originalSubject,
    })),
  });
}

// ── POST — send follow-up emails ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { runAll?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.runAll) {
    return NextResponse.json({ error: "runAll:true required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pending  = await findFollowUpLeads(user.id, supabase);

  if (pending.length === 0) {
    return NextResponse.json({
      followed_up: 0,
      skipped:     0,
      message:     "No leads need follow-up right now (all replied, in-sequence, or < 3 days since last email)",
      details:     [],
    });
  }

  console.log("[followup] Processing", pending.length, "follow-up leads");

  type FollowUpResult = { leadId: string; name: string; sent: boolean; reason?: string };
  const details: FollowUpResult[] = [];

  for (const lead of pending) {
    try {
      const angle     = pickAngle(lead.emailCount);
      const generated = await generateFollowUpEmail(
        { name: lead.name, company: lead.company, title: lead.title },
        lead.originalSubject,
        angle,
        lead.research,
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
        console.error("[followup] SMTP failed for", lead.email, err instanceof Error ? err.message : err);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("outreach_emails").insert({
        user_id:       user.id,
        lead_id:       lead.leadId,
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

      details.push({ leadId: lead.leadId, name: lead.name, sent: smtpOk });
    } catch (err) {
      console.error("[followup] Error processing lead", lead.leadId, err);
      details.push({ leadId: lead.leadId, name: lead.name, sent: false, reason: "unexpected error" });
    }
  }

  return NextResponse.json({
    followed_up: details.filter((d) => d.sent).length,
    skipped:     details.filter((d) => !d.sent).length,
    details,
  });
}

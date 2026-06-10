import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { groq } from "@/lib/groq";
import { transporter } from "@/lib/mailer";
import { CLIENT_CONFIG } from "@/lib/config";

export const maxDuration = 60;

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase  = createAdminClient();
  const todayISO  = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  // ── 6 parallel Supabase queries ───────────────────────────────────────────────
  const [
    newLeadsRes,
    scoredTodayRes,
    emailsSentRes,
    repliesRes,
    hotCountRes,
    bestLeadRes,
  ] = await Promise.all([
    // 1. New leads captured today
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayISO),

    // 2. Leads scored today (have a score > 0 and updated today)
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gt("score", 0)
      .neq("status", "unscored")
      .gte("created_at", todayISO),

    // 3. Emails sent today
    supabase
      .from("outreach_emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "sent")
      .gte("created_at", todayISO),

    // 4. Replies received today
    supabase
      .from("outreach_emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "replied")
      .gte("created_at", todayISO),

    // 5. Total hot leads (all time)
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "hot"),

    // 6. Best lead today (highest score)
    supabase
      .from("leads")
      .select("name, company, score, title")
      .eq("user_id", user.id)
      .gte("created_at", todayISO)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const stats = {
    newLeads:    newLeadsRes.count    ?? 0,
    scoredToday: scoredTodayRes.count ?? 0,
    emailsSent:  emailsSentRes.count  ?? 0,
    replies:     repliesRes.count     ?? 0,
    hotTotal:    hotCountRes.count    ?? 0,
    bestLead:    bestLeadRes.data     ?? null,
  };

  // ── Groq natural-language summary ─────────────────────────────────────────────
  const bestLeadLine = stats.bestLead
    ? `Best lead: ${stats.bestLead.name} (${stats.bestLead.title ?? "?"} at ${stats.bestLead.company ?? "?"}) — score ${stats.bestLead.score}.`
    : "No new leads were captured today.";

  let report = "";
  try {
    const completion = await groq.chat.completions.create({
      model:       "llama-3.3-70b-versatile",
      messages:    [{
        role:    "user",
        content: `You are a concise sales report writer for ${CLIENT_CONFIG.companyName ?? "Apex Lead Gen"}.

Today's stats:
- New leads captured: ${stats.newLeads}
- Leads scored by AI: ${stats.scoredToday}
- Emails sent: ${stats.emailsSent}
- Replies received: ${stats.replies}
- Total hot leads in pipeline: ${stats.hotTotal}
- ${bestLeadLine}

Write a 3–4 sentence natural-language daily report in the second person ("Today you..."). Be specific, upbeat, and actionable. Mention the best lead if one exists. End with one concrete suggestion for tomorrow.`,
      }],
      temperature: 0.65,
      max_tokens:  300,
    });
    report = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[daily-report] Groq summary failed:", err);
    report = `Today you captured ${stats.newLeads} new lead(s), scored ${stats.scoredToday}, and sent ${stats.emailsSent} email(s) with ${stats.replies} reply(s). Your hot pipeline stands at ${stats.hotTotal} lead(s). Keep following up with warm leads tomorrow.`;
  }

  // ── Send report email via SMTP ─────────────────────────────────────────────────
  let emailSent = false;
  let sentTo    = "";

  const recipientEmail = user.email ?? process.env.SMTP_USER;
  if (recipientEmail) {
    try {
      const todayStr = new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
    .card { background: #fff; border-radius: 16px; padding: 32px; max-width: 600px; margin: 0 auto; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .badge { background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; border-radius: 10px; padding: 10px 14px; font-size: 22px; }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .date { font-size: 13px; color: #64748b; margin-top: 2px; }
    .summary { background: #f1f5f9; border-radius: 12px; padding: 18px 20px; font-size: 15px; line-height: 1.7; color: #334155; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; }
    .stat-val { font-size: 26px; font-weight: 800; color: #0f172a; }
    .stat-lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
    .best { background: linear-gradient(135deg,#fef3c7,#fde68a); border-radius: 10px; padding: 14px 18px; font-size: 14px; color: #78350f; }
    .best strong { color: #92400e; }
    .footer { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">⚡</div>
      <div>
        <h1>Daily Lead Report</h1>
        <div class="date">${todayStr}</div>
      </div>
    </div>

    <div class="summary">${report.replace(/\n/g, "<br/>")}</div>

    <div class="grid">
      <div class="stat"><div class="stat-val">${stats.newLeads}</div><div class="stat-lbl">New Leads</div></div>
      <div class="stat"><div class="stat-val">${stats.emailsSent}</div><div class="stat-lbl">Emails Sent</div></div>
      <div class="stat"><div class="stat-val">${stats.replies}</div><div class="stat-lbl">Replies</div></div>
      <div class="stat"><div class="stat-val">${stats.scoredToday}</div><div class="stat-lbl">Scored Today</div></div>
      <div class="stat"><div class="stat-val">${stats.hotTotal}</div><div class="stat-lbl">Hot Pipeline</div></div>
      <div class="stat"><div class="stat-val">${stats.bestLead?.score ?? "—"}</div><div class="stat-lbl">Top Score</div></div>
    </div>

    ${stats.bestLead ? `
    <div class="best">
      🏆 <strong>Best lead today:</strong> ${stats.bestLead.name}
      ${stats.bestLead.title ? ` — ${stats.bestLead.title}` : ""}
      ${stats.bestLead.company ? ` at ${stats.bestLead.company}` : ""}
      (score: ${stats.bestLead.score})
    </div>
    ` : ""}

    <div class="footer">Sent by Apex Lead Gen · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}">View Dashboard</a></div>
  </div>
</body>
</html>`;

      await transporter.sendMail({
        from:    `"${CLIENT_CONFIG.companyName ?? "Apex Lead Gen"} Reports" <${process.env.SMTP_USER}>`,
        to:      recipientEmail,
        subject: `Daily Report — ${stats.newLeads} new lead${stats.newLeads !== 1 ? "s" : ""}, ${stats.emailsSent} email${stats.emailsSent !== 1 ? "s" : ""} sent`,
        text:    report,
        html,
      });
      emailSent = true;
      sentTo    = recipientEmail;
      console.log("[daily-report] Sent to:", recipientEmail);
    } catch (err) {
      console.error("[daily-report] Email send failed:", err);
    }
  }

  return NextResponse.json({ report, stats, emailSent, sentTo });
}

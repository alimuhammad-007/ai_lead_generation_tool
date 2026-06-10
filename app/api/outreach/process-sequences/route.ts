import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { transporter } from "@/lib/mailer";

export const maxDuration = 60;

// ── GET — process all due scheduled emails ─────────────────────────────────────
//
// Called by cron (Authorization: Bearer <CRON_SECRET>) or manually via session.
// Safe to call multiple times — only picks up emails where scheduled_for <= now.

export async function GET(req: NextRequest) {
  // ── Auth: accept either a cron secret header or a valid user session ──────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";

  let authed = false;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authed = true;
  } else {
    const serverClient = createServerSupabaseClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (user) authed = true;
  }

  if (!authed) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // ── Fetch all due scheduled emails ─────────────────────────────────────────
  const { data: dueEmails, error: fetchError } = await supabase
    .from("outreach_emails")
    .select("*, leads(name, email)")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .limit(100); // safety cap per run

  if (fetchError) {
    console.error("[process-sequences] Fetch error:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!dueEmails || dueEmails.length === 0) {
    return NextResponse.json({ processed: 0, failed: 0, message: "No emails due" });
  }

  let processed = 0;
  let failed    = 0;

  for (const email of dueEmails) {
    const lead = Array.isArray(email.leads) ? email.leads[0] : email.leads;

    if (!lead?.email) {
      console.warn("[process-sequences] Skipping email", email.id, "— lead has no email");
      // Mark as failed so it doesn't loop forever
      await supabase
        .from("outreach_emails")
        .update({ status: "failed" })
        .eq("id", email.id);
      failed++;
      continue;
    }

    // ── Send via SMTP ────────────────────────────────────────────────────────
    let sendFailed = false;
    try {
      await transporter.sendMail({
        from:    `"${process.env.SMTP_FROM_NAME ?? "Apex Lead Gen"}" <${process.env.SMTP_USER}>`,
        to:      lead.email,
        subject: email.subject,
        text:    email.body,
        html:    email.html,
      });
      console.log("[process-sequences] Sent to:", lead.email, "| subject:", email.subject);
    } catch (err) {
      sendFailed = true;
      console.error("[process-sequences] SMTP error for", email.id, ":", err instanceof Error ? err.message : err);
    }

    // ── Update status ────────────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from("outreach_emails")
      .update({
        status:  sendFailed ? "failed" : "sent",
        sent_at: sendFailed ? null : new Date().toISOString(),
      })
      .eq("id", email.id);

    if (updateError) {
      console.error("[process-sequences] Update error for", email.id, ":", updateError.message);
    }

    sendFailed ? failed++ : processed++;
  }

  return NextResponse.json({
    processed,
    failed,
    total: dueEmails.length,
    ranAt: now,
  });
}

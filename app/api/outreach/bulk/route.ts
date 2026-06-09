import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { transporter } from "@/lib/mailer";
import { generateEmail, bodyToHtml } from "@/lib/emailGenerator";

export const maxDuration = 60;

interface BulkSendRequest {
  leadIds: string[];
}

type BulkResult = {
  lead_id: string;
  name:    string;
  status:  "sent" | "failed";
  error?:  string;
};

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: BulkSendRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { leadIds } = body;

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds must be a non-empty array" }, { status: 400 });
  }
  if (leadIds.length > 50) {
    return NextResponse.json({ error: "Maximum 50 leads per bulk send" }, { status: 400 });
  }

  // ── Fetch leads (scoped to authenticated user) ─────────────────────────────
  const adminClient = createAdminClient();

  const { data: leads, error: leadsError } = await adminClient
    .from("leads")
    .select("id, name, email, company, title")
    .in("id", leadIds)
    .eq("user_id", user.id);

  if (leadsError || !leads) {
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // ── Process each lead (don't stop on single failure) ──────────────────────
  const settlements = await Promise.allSettled(
    leads.map(async (lead): Promise<BulkResult> => {
      // Skip leads with no real email
      if (!lead.email || lead.email === "unknown@unknown.com") {
        return { lead_id: lead.id, name: lead.name, status: "failed", error: "No email address" };
      }

      // Generate personalised email
      let generated: { subject: string; body: string };
      try {
        generated = await generateEmail({
          name:    lead.name,
          company: lead.company ?? "",
          title:   lead.title   ?? "",
          tone:    "professional",
        });
      } catch {
        return { lead_id: lead.id, name: lead.name, status: "failed", error: "Generation failed" };
      }

      const tracking_id = randomUUID();
      const html        = bodyToHtml(generated.body, `${appUrl}/api/outreach/track?id=${tracking_id}`);
      const now         = new Date().toISOString();

      // Send via SMTP
      let sendFailed = false;
      try {
        await transporter.sendMail({
          from:    `"${process.env.SMTP_FROM_NAME ?? "Apex Lead Gen"}" <${process.env.SMTP_USER}>`,
          to:      lead.email,
          subject: generated.subject,
          text:    generated.body,
          html,
        });
      } catch (err) {
        sendFailed = true;
        console.error(`[outreach/bulk] SMTP error for ${lead.name}:`, err instanceof Error ? err.message : err);
      }

      // Save to outreach_emails regardless of send outcome
      const bulkPayload = {
        user_id:       user.id,
        lead_id:       lead.id,
        campaign_id:   null,
        sequence_day:  1 as const,
        subject:       generated.subject,
        body:          generated.body,
        html,
        status:        sendFailed ? "failed" : "sent",
        tracking_id,
        scheduled_for: now,
        sent_at:       sendFailed ? null : now,
      };

      console.log(`[outreach/bulk] inserting for ${lead.name}:`, JSON.stringify({
        user_id: bulkPayload.user_id,
        lead_id: bulkPayload.lead_id,
        status:  bulkPayload.status,
      }));

      const { data: insertedRow, error: insertError } = await adminClient
        .from("outreach_emails")
        .insert(bulkPayload)
        .select()
        .single();

      console.log(`[outreach/bulk] insert result for ${lead.name}:`, insertError
        ? `ERROR code=${insertError.code} msg=${insertError.message} details=${insertError.details}`
        : `OK id=${insertedRow?.id}`
      );

      if (insertError) {
        console.error(`[outreach/bulk] DB insert error for ${lead.name}:`, insertError.message);
      }

      if (sendFailed) {
        return { lead_id: lead.id, name: lead.name, status: "failed", error: "SMTP error" };
      }

      return { lead_id: lead.id, name: lead.name, status: "sent" };
    })
  );

  // ── Collate results ────────────────────────────────────────────────────────
  const results: BulkResult[] = settlements.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : { lead_id: leads[i]?.id ?? "", name: leads[i]?.name ?? "Unknown", status: "failed", error: "Unexpected error" }
  );

  const sent   = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({ sent, failed, results });
}

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { transporter } from "@/lib/mailer";
import { generateEmail, bodyToHtml, EmailTone } from "@/lib/emailGenerator";

interface SendRequest {
  leadId?:   string;
  lead_id?:  string;

  generate_only?: boolean;

  subject?:          string;
  body?:             string;
  subject_override?: string;
  body_override?:    string;

  campaign_id?:  string;
  sequence_day?: 1 | 3 | 7;
  tone?:         EmailTone;
}

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: SendRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    generate_only = false,
    sequence_day  = 1,
    tone          = "professional",
  } = body;

  const leadId = body.leadId ?? body.lead_id;
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const subjectOverride = body.subject ?? body.subject_override;
  const bodyOverride    = body.body    ?? body.body_override;

  // ── Fetch lead ─────────────────────────────────────────────────────────────
  const adminDb = createAdminClient();

  const { data: lead, error: leadError } = await adminDb
    .from("leads")
    .select("id, name, email, company, title")
    .eq("id", leadId)
    .eq("user_id", user.id)
    .single();

  if (leadError || !lead) {
    console.error("[send] Lead fetch error:", leadError?.message, "leadId:", leadId, "user:", user.id);
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!lead.email) {
    return NextResponse.json({ error: "Lead has no email address" }, { status: 422 });
  }

  // ── Generate email content ─────────────────────────────────────────────────
  let subject: string;
  let emailBody: string;

  if (subjectOverride?.trim() && bodyOverride?.trim()) {
    subject   = subjectOverride.trim();
    emailBody = bodyOverride.trim();
  } else {
    let generated: { subject: string; body: string };
    try {
      generated = await generateEmail({
        name:        lead.name,
        company:     lead.company ?? "",
        title:       lead.title   ?? "",
        sequenceDay: sequence_day,
        tone,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Email generation failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
    subject   = subjectOverride?.trim() || generated.subject;
    emailBody = bodyOverride?.trim()   || generated.body;
  }

  // ── generate_only: return draft without sending or saving ──────────────────
  if (generate_only) {
    return NextResponse.json({ subject, body: emailBody });
  }

  // ── Build HTML ─────────────────────────────────────────────────────────────
  const tracking_id = randomUUID();
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const html        = bodyToHtml(emailBody, `${appUrl}/api/outreach/track?id=${tracking_id}`);

  // ── Send via SMTP ──────────────────────────────────────────────────────────
  let sendFailed = false;
  try {
    await transporter.sendMail({
      from:    `"${process.env.SMTP_FROM_NAME ?? "Apex Lead Gen"}" <${process.env.SMTP_USER}>`,
      to:      lead.email,
      subject,
      text:    emailBody,
      html,
    });
    console.log("[send] SMTP success for:", lead.email);
  } catch (err) {
    sendFailed = true;
    console.error("[send] SMTP error:", err instanceof Error ? err.message : err);
  }

  // ── Persist to outreach_emails ─────────────────────────────────────────────
  console.log("[send] Attempting DB insert with:", {
    user_id: user.id,
    lead_id: lead.id,
    subject,
    status: sendFailed ? "failed" : "sent",
  });

  const { data, error: insertError } = await adminDb
    .from("outreach_emails")
    .insert({
      user_id:  user.id,
      lead_id:  lead.id,
      subject:  subject,
      body:     emailBody,
      status:   sendFailed ? "failed" : "sent",
      sent_at:  sendFailed ? null : new Date().toISOString(),
    })
    .select()
    .single();

  console.log("[send] DB insert result:", { data, error: insertError });

  if (insertError) {
    return NextResponse.json(
      {
        error:        "DB insert failed",
        insertError:  { code: insertError.code, message: insertError.message, details: insertError.details, hint: insertError.hint },
        emailSent:    !sendFailed,
      },
      { status: 500 }
    );
  }

  if (sendFailed) {
    return NextResponse.json(
      { error: "SMTP delivery failed — record saved with status 'failed'", email: data },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, email: data });
}

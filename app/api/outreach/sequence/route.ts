import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generateEmail, bodyToHtml, EmailAngle } from "@/lib/emailGenerator";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SequenceType = "standard" | "aggressive" | "gentle";

interface SequenceStep {
  /** Nominal day label shown in the UI (Day 1, Day 3, …) */
  day:    number;
  /** Actual offset in days from now (day - 1) */
  offset: number;
  angle:  EmailAngle;
  label:  string;
}

// ── Schedule definitions ───────────────────────────────────────────────────────

export const SEQUENCE_SCHEDULES: Record<SequenceType, SequenceStep[]> = {
  standard: [
    { day:  1, offset:  0, angle: "introduction",      label: "Introduction"      },
    { day:  3, offset:  2, angle: "value_proposition", label: "Value Proposition" },
    { day:  7, offset:  6, angle: "social_proof",      label: "Social Proof"      },
    { day: 14, offset: 13, angle: "breakup",            label: "Breakup Email"     },
  ],
  aggressive: [
    { day:  1, offset:  0, angle: "introduction",      label: "Introduction"      },
    { day:  2, offset:  1, angle: "value_proposition", label: "Value Proposition" },
    { day:  4, offset:  3, angle: "social_proof",      label: "Social Proof"      },
    { day:  7, offset:  6, angle: "breakup",            label: "Breakup Email"     },
  ],
  gentle: [
    { day:  1, offset:  0, angle: "introduction",      label: "Introduction"      },
    { day:  5, offset:  4, angle: "value_proposition", label: "Value Proposition" },
    { day: 14, offset: 13, angle: "social_proof",      label: "Social Proof"      },
    { day: 30, offset: 29, angle: "breakup",            label: "Breakup Email"     },
  ],
};

// ── POST — start a sequence ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { leadId?: string; lead_id?: string; sequenceType?: string; campaign_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const leadId       = body.leadId ?? body.lead_id;
  const sequenceType = (body.sequenceType ?? "standard") as SequenceType;

  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
  if (!SEQUENCE_SCHEDULES[sequenceType]) {
    return NextResponse.json({ error: "sequenceType must be standard | aggressive | gentle" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, name, email, company, title")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (!lead.email) {
    return NextResponse.json({ error: "Lead has no email address" }, { status: 422 });
  }

  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const baseTime = Date.now();
  const steps    = SEQUENCE_SCHEDULES[sequenceType];

  const inserts: {
    user_id:       string;
    lead_id:       string;
    campaign_id:   string | null;
    sequence_day:  number;
    subject:       string;
    body:          string;
    html:          string;
    status:        "scheduled";
    tracking_id:   string;
    scheduled_for: string;
  }[] = [];

  // Generate each email sequentially to avoid hammering Groq rate limits
  for (const step of steps) {
    let generated: { subject: string; body: string };
    try {
      generated = await generateEmail({
        name:    lead.name,
        company: lead.company ?? "",
        title:   lead.title   ?? "",
        angle:   step.angle,
      });
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to generate Day-${step.day} email: ${err instanceof Error ? err.message : "unknown"}` },
        { status: 502 }
      );
    }

    const tracking_id  = randomUUID();
    const scheduledFor = new Date(baseTime + step.offset * 86_400_000).toISOString();

    inserts.push({
      user_id:       user.id,
      lead_id:       leadId,
      campaign_id:   body.campaign_id ?? null,
      sequence_day:  step.day,
      subject:       generated.subject,
      body:          generated.body,
      html:          bodyToHtml(generated.body, `${appUrl}/api/outreach/track?id=${tracking_id}`),
      status:        "scheduled",
      tracking_id,
      scheduled_for: scheduledFor,
    });
  }

  const { data: records, error: insertError } = await supabase
    .from("outreach_emails")
    .insert(inserts)
    .select();

  if (insertError) {
    console.error("[sequence] Insert error:", insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    sequenceId:      randomUUID(), // logical group identifier
    emailsScheduled: records?.length ?? 0,
    sequenceType,
    schedule: records?.map((r) => ({
      id:           r.id,
      sequenceDay:  r.sequence_day,
      subject:      r.subject,
      scheduledFor: r.scheduled_for,
    })) ?? [],
  });
}

// ── DELETE — cancel a single scheduled email ───────────────────────────────────

export async function DELETE(req: NextRequest) {
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("outreach_emails")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "scheduled");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

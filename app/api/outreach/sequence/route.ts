import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generateEmail, bodyToHtml, EmailTone } from "@/lib/emailGenerator";

interface SequenceRequest {
  lead_id: string;
  campaign_id?: string;
  tone?: EmailTone;
}

const SEQUENCE_DAYS = [1, 3, 7] as const;

export async function POST(req: NextRequest) {
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: SequenceRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { lead_id, campaign_id, tone = "professional" } = body;

  if (!lead_id) {
    return NextResponse.json({ error: "lead_id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, name, email, company, title")
    .eq("id", lead_id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const baseTime = Date.now();

  // Build each step sequentially — avoids hammering Groq RPM limit
  const inserts: {
    user_id: string;
    lead_id: string;
    campaign_id: string | null;
    sequence_day: 1 | 3 | 7;
    subject: string;
    body: string;
    html: string;
    status: "scheduled";
    tracking_id: string;
    scheduled_for: string;
  }[] = [];

  for (const day of SEQUENCE_DAYS) {
    let generated: { subject: string; body: string };
    try {
      generated = await generateEmail({
        name: lead.name,
        company: lead.company ?? "",
        title: lead.title ?? "",
        sequenceDay: day,
        tone,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      return NextResponse.json(
        { error: `Failed to generate day-${day} email: ${message}` },
        { status: 502 }
      );
    }

    const tracking_id = randomUUID();
    const pixelUrl = `${appUrl}/api/outreach/track?id=${tracking_id}`;
    // Day 1 → offset 0 days, Day 3 → +2 days, Day 7 → +6 days
    const scheduledFor = new Date(baseTime + (day - 1) * 86_400_000).toISOString();

    inserts.push({
      user_id:       user.id,
      lead_id,
      campaign_id:   campaign_id ?? null,
      sequence_day:  day,
      subject:       generated.subject,
      body:          generated.body,
      html:          bodyToHtml(generated.body, pixelUrl),
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
    console.error("[outreach/sequence] Insert error:", insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, sequence: records });
}

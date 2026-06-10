import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ── GET — hot leads added in the last 24 hours ────────────────────────────────

export async function GET() {
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase   = createAdminClient();
  const since      = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: alerts, error } = await supabase
    .from("leads")
    .select("id, name, company, title, email, score, status, created_at, alerted_at")
    .eq("user_id", user.id)
    .eq("status", "hot")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Separate new (unalerted) from already-acknowledged alerts
  const newAlerts = (alerts ?? []).filter((l) => !l.alerted_at);

  return NextResponse.json({
    alerts: alerts ?? [],
    newAlerts,
    count: newAlerts.length,
    total: (alerts ?? []).length,
  });
}

// ── POST — mark a lead as alerted ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { leadId?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("leads")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ alerted_at: new Date().toISOString() } as any)
    .eq("id", body.leadId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

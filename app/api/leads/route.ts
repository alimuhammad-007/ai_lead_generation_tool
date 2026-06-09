import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { scoreLeadWithAI } from "@/lib/groq";
import { sendLeadNotification } from "@/lib/mailer";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { name, email, company, title, linkedin_url } = body;

  if (!name || !email || !company || !title) {
    return NextResponse.json(
      { error: "name, email, company, and title are required" },
      { status: 400 }
    );
  }

  // AI scoring via Groq
  const scoring = await scoreLeadWithAI({ name, email, company, title, linkedin_url });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      user_id: user.id,
      name,
      email,
      company,
      title,
      linkedin_url: linkedin_url ?? null,
      score: scoring.score,
      status: scoring.status,
      score_reason: scoring.reasoning,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget email notification
  sendLeadNotification({ name, email, company, score: scoring.score, status: scoring.status }).catch(
    (err) => console.error("Email notification failed:", err)
  );

  return NextResponse.json(data, { status: 201 });
}

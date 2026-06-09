import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { scoreBatchWithAI } from "@/lib/groq";
import { Lead } from "@/types/database";

// Allow up to 60 s on Vercel Pro; ignored on local dev / self-hosted.
export const maxDuration = 60;

type RequestBody =
  | { lead_id: string }
  | { lead_ids: string[] }
  | { score_all_unscored: true };

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ---- Resolve which leads to score ---------------------------------------

  let leadsToScore: Lead[] = [];

  if ("lead_id" in body) {
    // ── Single lead ──────────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", body.lead_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    leadsToScore = [data as Lead];
  } else if ("lead_ids" in body) {
    // ── Explicit batch (max 50) ───────────────────────────────────────────────
    const ids = body.lead_ids;
    if (!ids.length) {
      return NextResponse.json({ error: "lead_ids must not be empty" }, { status: 400 });
    }
    if (ids.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 leads per batch — use score_all_unscored for larger sets" },
        { status: 400 }
      );
    }
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .in("id", ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    leadsToScore = (data as Lead[]) ?? [];
  } else if ("score_all_unscored" in body) {
    // ── All unscored (max 100 per call) ──────────────────────────────────────
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("status", "unscored")
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    leadsToScore = (data as Lead[]) ?? [];
  } else {
    return NextResponse.json(
      { error: "Body must contain one of: lead_id, lead_ids[], or score_all_unscored: true" },
      { status: 400 }
    );
  }

  if (leadsToScore.length === 0) {
    return NextResponse.json({ scored: [], errors: [], message: "No leads to score" });
  }

  // ---- Score via Groq (concurrent, capped at 5 parallel requests) ---------

  const scoringResults = await scoreBatchWithAI(
    leadsToScore.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email ?? "",
      company: l.company ?? "",
      title: l.title ?? "",
      linkedin_url: l.linkedin_url,
    }))
  );

  // ---- Persist scores back to Supabase ------------------------------------

  const updatePromises = scoringResults.map((r) =>
    supabase
      .from("leads")
      .update({
        score: r.score,
        status: r.status,
        score_reason: r.reasoning,
      })
      .eq("id", r.id!)
      .select("id, name, email, score, status, score_reason")
      .single()
  );

  const settled = await Promise.allSettled(updatePromises);

  const scored: unknown[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  settled.forEach((result, i) => {
    const id = scoringResults[i].id!;
    if (result.status === "rejected") {
      errors.push({ id, error: String(result.reason) });
    } else if (result.value.error) {
      errors.push({ id, error: result.value.error.message });
    } else if (result.value.data) {
      scored.push({
        ...result.value.data,
        breakdown: scoringResults[i].breakdown,
      });
    }
  });

  return NextResponse.json({ scored, errors });
}

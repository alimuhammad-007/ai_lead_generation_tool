import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { groq } from "@/lib/groq";
import { CLIENT_CONFIG } from "@/lib/config";
import type { IcpMatch } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

interface IcpCriteria {
  targetIndustries: string[];
  targetTitles:     string[];
  targetCompanySize: string;
  targetLocation:   string;
}

interface IcpResult {
  icp_score: number;
  icp_match: IcpMatch;
  reasons:   string[];
}

// ── Groq prompt ────────────────────────────────────────────────────────────────

function buildPrompt(
  lead: { name: string; title: string | null; company: string | null; email: string | null },
  criteria: IcpCriteria
): string {
  return `You are a B2B sales analyst scoring how well a lead matches our Ideal Customer Profile (ICP).

ICP CRITERIA:
- Target Industries:   ${criteria.targetIndustries.join(", ")}
- Target Titles:       ${criteria.targetTitles.join(", ")}
- Target Company Size: ${criteria.targetCompanySize} employees
- Target Location:     ${criteria.targetLocation}

LEAD:
- Name:    ${lead.name}
- Title:   ${lead.title    ?? "unknown"}
- Company: ${lead.company  ?? "unknown"}
- Email:   ${lead.email    ?? "unknown"}

Score using these four dimensions:

1. Title Match (0-40 pts)
   40 → Exact match to a target title (CEO, Founder, CTO, Director, Manager)
   28 → Close variant (Co-Founder, Chief of Staff, VP, SVP, Head of)
   15 → Related but junior (Senior Manager, Lead, Principal)
    5 → IC or unrelated role
    0 → Completely mismatched or unknown

2. Industry Match (0-30 pts)
   30 → Company clearly in a target industry (inferred from name/domain/title)
   18 → Probably in target industry
    8 → Ambiguous — could be target industry
    0 → Clearly different industry

3. Company Size Match (0-20 pts)
   20 → Company appears to match target size (startup/SMB cues)
   10 → Unknown — no clear size signal
    0 → Clearly large enterprise (Fortune 500 cues in name)

4. Data Quality (0-10 pts)
   10 → All four fields populated with real values
    7 → Three fields populated
    4 → Two fields populated
    1 → Only name available

ICP Match tier:
- 75–100 → "perfect"
- 45–74  → "good"
- 0–44   → "poor"

Return ONLY this JSON — no code fences, no extra text:
{
  "icp_score": <integer 0-100>,
  "icp_match": "<perfect|good|poor>",
  "reasons":   ["<specific reason 1>", "<specific reason 2>", "<specific reason 3>"]
}`;
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { leadId?: string; icpCriteria?: IcpCriteria };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  // Use provided criteria or fall back to global config
  const criteria: IcpCriteria = body.icpCriteria ?? {
    targetIndustries: [...CLIENT_CONFIG.icpCriteria.targetIndustries],
    targetTitles:     [...CLIENT_CONFIG.icpCriteria.targetTitles],
    targetCompanySize: CLIENT_CONFIG.icpCriteria.targetCompanySize,
    targetLocation:   CLIENT_CONFIG.icpCriteria.targetLocation,
  };

  const supabase = createAdminClient();

  // ── Fetch lead ─────────────────────────────────────────────────────────────
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, name, title, company, email, user_id")
    .eq("id", body.leadId)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (lead.user_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // ── Groq ICP scoring ───────────────────────────────────────────────────────
  let raw = "{}";
  try {
    const completion = await groq.chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{ role: "user", content: buildPrompt(lead, criteria) }],
      temperature:     0.1,
      max_tokens:      512,
      response_format: { type: "json_object" },
    });
    raw = completion.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    console.error("[icp-score] Groq error:", err);
    return NextResponse.json({ error: "AI scoring failed — Groq unavailable" }, { status: 502 });
  }

  // ── Parse result ───────────────────────────────────────────────────────────
  let result: IcpResult;
  try {
    const parsed = JSON.parse(raw);
    const rawScore = Number(parsed.icp_score ?? 0);
    const score    = Math.max(0, Math.min(100, isNaN(rawScore) ? 0 : rawScore));
    const match: IcpMatch =
      parsed.icp_match === "perfect" ? "perfect" :
      parsed.icp_match === "good"    ? "good"    : "poor";

    result = {
      icp_score: score,
      icp_match: match,
      reasons:   Array.isArray(parsed.reasons) ? (parsed.reasons as string[]).slice(0, 5) : [],
    };
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
  }

  // ── Save to leads.icp_score ────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("leads")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ icp_score: result.icp_score } as any)
    .eq("id", body.leadId);

  if (updateError) {
    console.error("[icp-score] DB update error:", updateError.message);
    // Non-fatal — still return the result even if DB save fails
  }

  return NextResponse.json({
    icpScore: result.icp_score,
    icpMatch: result.icp_match,
    reasons:  result.reasons,
  });
}

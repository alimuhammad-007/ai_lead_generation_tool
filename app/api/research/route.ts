import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { groq } from "@/lib/groq";
import type { LeadResearch } from "@/types/database";

export const maxDuration = 60;

// ── Serper helpers ─────────────────────────────────────────────────────────────

const SERPER_URL = "https://google.serper.dev/search";

interface SerperResult {
  title: string;
  snippet?: string;
  link: string;
}

interface SerperResponse {
  organic?: SerperResult[];
}

async function serperSearch(query: string, apiKey: string): Promise<SerperResult[]> {
  try {
    const res = await fetch(SERPER_URL, {
      method:  "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body:    JSON.stringify({ q: query, num: 5 }),
    });
    const data: SerperResponse = await res.json();
    return data.organic ?? [];
  } catch {
    return [];
  }
}

// ── Groq prompt ────────────────────────────────────────────────────────────────

function buildPrompt(
  lead: { name: string; company: string; title: string },
  searchContext: string
): string {
  return `You are a B2B sales intelligence analyst. Based on the search results below, generate a concise research brief to help a salesperson reach out to ${lead.name} (${lead.title ?? "unknown title"}) at ${lead.company ?? "their company"}.

SEARCH RESULTS:
${searchContext || "No search results were returned. Use your general knowledge about the company."}

Generate a JSON research brief. Be specific, accurate, and actionable. If no relevant news was found, say so plainly.

Return ONLY this JSON — no code fences, no extra text:
{
  "company_summary": "<2-3 sentences: what the company does, their market, and approximate scale>",
  "recent_news": "<most relevant recent news, product launches, funding, or events — or 'No recent news found' if nothing relevant>",
  "pain_points": "<2-3 likely pain points or business challenges for a company in their space>",
  "talking_points": [
    "<personalized opener 1 — reference something specific about the company or industry>",
    "<personalized opener 2 — connect their role to a concrete value you could provide>",
    "<personalized opener 3 — reference a trend, challenge, or recent development>"
  ],
  "best_outreach_angle": "<one punchy sentence: the single best subject line or angle for a cold email to this person>"
}`;
}

// ── POST — research a lead ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    return NextResponse.json({ error: "SERPER_API_KEY not configured" }, { status: 500 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { leadId?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ── Fetch lead ─────────────────────────────────────────────────────────────
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, name, email, company, title, user_id")
    .eq("id", body.leadId)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  // Ensure the authenticated user owns this lead
  if (lead.user_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const company = (lead.company ?? "").trim() || "Unknown Company";
  const name    = lead.name;
  const title   = lead.title ?? "";

  // ── 3 parallel Serper searches ─────────────────────────────────────────────
  const [newsResults, profileResults, businessResults] = await Promise.all([
    serperSearch(`"${company}" news 2024 2025`,                                  serperKey),
    serperSearch(`"${company}" "${name}" interview OR profile OR announcement`,   serperKey),
    serperSearch(`"${company}" funding OR "product launch" OR expansion OR hire`, serperKey),
  ]);

  // Merge and truncate to avoid huge prompts
  const allResults = [
    ...newsResults.map((r)    => ({ ...r, source: "News"           })),
    ...profileResults.map((r) => ({ ...r, source: "Profile/Interview" })),
    ...businessResults.map((r)=> ({ ...r, source: "Business Intel" })),
  ];

  const searchContext = allResults
    .slice(0, 12)
    .map((r, i) =>
      `[${i + 1}] [${r.source}] ${r.title}\n${r.snippet?.slice(0, 200) ?? "(no snippet)"}`
    )
    .join("\n\n");

  // ── Groq analysis ──────────────────────────────────────────────────────────
  let raw = "{}";
  try {
    const completion = await groq.chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{ role: "user", content: buildPrompt({ name, company, title }, searchContext) }],
      temperature:     0.4,
      max_tokens:      1024,
      response_format: { type: "json_object" },
    });
    raw = completion.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    console.error("[research] Groq error:", err);
    return NextResponse.json({ error: "AI analysis failed — Groq unavailable" }, { status: 502 });
  }

  // ── Parse AI response ──────────────────────────────────────────────────────
  let research: LeadResearch;
  try {
    const parsed = JSON.parse(raw);
    research = {
      company_summary:     (parsed.company_summary     as string) ?? "",
      recent_news:         (parsed.recent_news         as string) ?? "",
      pain_points:         (parsed.pain_points         as string) ?? "",
      talking_points:      Array.isArray(parsed.talking_points) ? (parsed.talking_points as string[]) : [],
      best_outreach_angle: (parsed.best_outreach_angle as string) ?? "",
      researched_at:       new Date().toISOString(),
    };
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
  }

  // ── Persist to leads.research ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await supabase
    .from("leads")
    .update({ research } as any)
    .eq("id", body.leadId);

  if (updateError) {
    console.error("[research] DB update error:", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ research });
}

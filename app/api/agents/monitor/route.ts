import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { scoreLeadWithAI, groq } from "@/lib/groq";
import { CLIENT_CONFIG } from "@/lib/config";

export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiscoveredLead {
  name:         string;
  company:      string;
  title:        string;
  email:        string | null;
  linkedin_url: string | null;
  source:       string;
}

// ── Serper ────────────────────────────────────────────────────────────────────

const SERPER_URL = "https://google.serper.dev/search";

interface SerperResult { title: string; snippet?: string; link?: string; }

async function serperSearch(query: string, apiKey: string): Promise<SerperResult[]> {
  try {
    const r = await fetch(SERPER_URL, {
      method:  "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body:    JSON.stringify({ q: query, num: 8 }),
    });
    return ((await r.json()).organic ?? []) as SerperResult[];
  } catch { return []; }
}

// ── Build ICP-based search queries ───────────────────────────────────────────

function buildSearchQueries(): string[] {
  const industries = CLIENT_CONFIG.icpCriteria.targetIndustries.slice(0, 3);
  const titles     = CLIENT_CONFIG.icpCriteria.targetTitles.slice(0, 3);

  // Mix industry + title combos for varied results
  return [
    // LinkedIn-style person search
    `site:linkedin.com/in (${titles.join(" OR ")}) (${industries.join(" OR ")})`,
    // Contact page search for decision makers
    `(${titles.join(" OR ")}) (${industries.join(" OR ")}) company "contact" OR "email" 2024 2025`,
    // News/profile mentions of decision makers in target industries
    `(${industries.join(" OR ")}) (${titles.join(" OR ")}) announcement OR "joined" OR "appointed" 2024 2025`,
  ];
}

// ── Extract structured leads from search results using Groq ──────────────────

async function extractLeadsFromResults(
  results: SerperResult[],
  targetTitles: readonly string[],
): Promise<DiscoveredLead[]> {
  if (results.length === 0) return [];

  const snippets = results
    .slice(0, 15)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet?.slice(0, 200) ?? ""}${r.link ? `\nURL: ${r.link}` : ""}`)
    .join("\n\n");

  const prompt = `Extract lead information from these search results. Focus on finding real people in decision-making roles.

Target titles to prioritize: ${targetTitles.join(", ")}

Search results:
${snippets}

Rules:
- Only extract people where you can clearly identify name AND company AND approximate title
- Email is almost never in search results — leave null unless explicitly visible
- LinkedIn URL only if the result URL is a linkedin.com/in/... link
- Keep source brief (e.g. "LinkedIn profile", "company blog", "news mention")
- Skip generic/vague results with no clear person

Return ONLY JSON:
{"leads":[{"name":"...","company":"...","title":"...","email":null,"linkedin_url":null,"source":"..."}]}`;

  try {
    const completion = await groq.chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{ role: "user", content: prompt }],
      temperature:     0.3,
      max_tokens:      1200,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const raw    = Array.isArray(parsed.leads) ? parsed.leads : [];

    return raw
      .filter((l: Partial<DiscoveredLead>) => l.name?.trim() && l.company?.trim() && l.title?.trim())
      .map((l: Partial<DiscoveredLead>) => ({
        name:         (l.name         ?? "").trim(),
        company:      (l.company      ?? "").trim(),
        title:        (l.title        ?? "").trim(),
        email:        l.email         ?? null,
        linkedin_url: l.linkedin_url  ?? null,
        source:       (l.source       ?? "search").trim(),
      })) as DiscoveredLead[];
  } catch (err) {
    console.error("[monitor] Groq extraction failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Filter out leads already in the database ─────────────────────────────────

async function deduplicateLeads(
  candidates:  DiscoveredLead[],
  userId:      string,
  supabase:    ReturnType<typeof createAdminClient>,
): Promise<DiscoveredLead[]> {
  if (candidates.length === 0) return [];

  const { data: existing } = await supabase
    .from("leads")
    .select("name, email, company")
    .eq("user_id", userId);

  const existingEmails  = new Set(
    (existing ?? []).map((l) => l.email?.toLowerCase().trim()).filter(Boolean),
  );
  const existingCombos  = new Set(
    (existing ?? []).map((l) =>
      `${l.name?.toLowerCase().trim()}|${l.company?.toLowerCase().trim()}`
    ).filter((s) => s !== "|"),
  );

  return candidates.filter((c) => {
    if (c.email && existingEmails.has(c.email.toLowerCase().trim())) return false;
    const combo = `${c.name.toLowerCase()}|${c.company.toLowerCase()}`;
    if (existingCombos.has(combo)) return false;
    return true;
  });
}

// ── Core discovery (shared by GET and POST) ───────────────────────────────────

async function discoverLeads(
  userId:  string,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<DiscoveredLead[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    console.warn("[monitor] SERPER_API_KEY not set — returning empty results");
    return [];
  }

  const queries = buildSearchQueries();
  console.log("[monitor] Running", queries.length, "searches");

  // Run all searches in parallel
  const searchResults = await Promise.all(
    queries.map((q) => serperSearch(q, serperKey)),
  );
  const allResults = searchResults.flat();

  // Extract and deduplicate
  const extracted = await extractLeadsFromResults(
    allResults,
    CLIENT_CONFIG.icpCriteria.targetTitles,
  );
  const deduped   = await deduplicateLeads(extracted, userId, supabase);

  console.log("[monitor] Found", extracted.length, "candidates,", deduped.length, "are new");
  return deduped;
}

// ── GET — discover new leads (read-only) ─────────────────────────────────────

export async function GET() {
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createAdminClient();
  const leads    = await discoverLeads(user.id, supabase);

  return NextResponse.json({
    found: leads.length,
    leads,
    searchedFor: {
      industries: CLIENT_CONFIG.icpCriteria.targetIndustries,
      titles:     CLIENT_CONFIG.icpCriteria.targetTitles,
    },
  });
}

// ── POST — discover + auto-import + score ─────────────────────────────────────

export async function POST(req: NextRequest) {
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { autoImport?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.autoImport) {
    return NextResponse.json({ error: "autoImport:true required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const newLeads = await discoverLeads(user.id, supabase);

  if (newLeads.length === 0) {
    return NextResponse.json({
      found:    0,
      imported: 0,
      hot:      0,
      warm:     0,
      cold:     0,
      message:  "No new leads found — all discovered leads are already in your database",
      details:  [],
    });
  }

  // Import + score sequentially to respect Groq rate limits
  type ImportResult = {
    name:    string;
    company: string;
    score:   number;
    status:  string;
    source:  string;
  };

  const details: ImportResult[] = [];

  for (const candidate of newLeads.slice(0, 15)) {
    try {
      // Score first
      const scored = await scoreLeadWithAI({
        name:  candidate.name,
        email: candidate.email ?? "",
        company: candidate.company,
        title:   candidate.title,
        linkedin_url: candidate.linkedin_url,
      });

      // Insert to DB
      const { data: inserted, error: insertErr } = await supabase
        .from("leads")
        .insert({
          user_id:     user.id,
          name:        candidate.name,
          email:       candidate.email,
          company:     candidate.company,
          title:       candidate.title,
          linkedin_url: candidate.linkedin_url,
          phone:       null,
          score:       scored.score,
          status:      scored.status,
          score_reason: scored.reasoning,
          client_id:   null,
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        console.error("[monitor] Insert failed for", candidate.name, insertErr?.message);
        continue;
      }

      details.push({
        name:    candidate.name,
        company: candidate.company,
        score:   scored.score,
        status:  scored.status,
        source:  candidate.source,
      });
    } catch (err) {
      console.error("[monitor] Error processing candidate", candidate.name, err);
    }
  }

  return NextResponse.json({
    found:    newLeads.length,
    imported: details.length,
    hot:      details.filter((d) => d.status === "hot").length,
    warm:     details.filter((d) => d.status === "warm").length,
    cold:     details.filter((d) => d.status === "cold").length,
    details,
  });
}

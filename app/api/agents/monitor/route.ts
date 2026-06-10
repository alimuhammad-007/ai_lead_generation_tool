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

interface SerperResult {
  title:    string;
  snippet?: string;
  link?:    string;
}

// ── Serper search with full logging ───────────────────────────────────────────

const SERPER_URL = "https://google.serper.dev/search";

async function serperSearch(query: string, apiKey: string): Promise<SerperResult[]> {
  console.log("[monitor] serperSearch query:", query);
  try {
    const res  = await fetch(SERPER_URL, {
      method:  "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body:    JSON.stringify({ q: query, num: 10 }),
    });

    const json    = await res.json();
    const organic = (json.organic ?? []) as SerperResult[];

    console.log("[monitor] serperSearch returned", organic.length, "results");
    if (organic.length > 0) {
      console.log("[monitor] sample result:", JSON.stringify({
        title:   organic[0].title,
        snippet: organic[0].snippet?.slice(0, 120),
        link:    organic[0].link,
      }));
    } else {
      // Log the full response to understand why we got nothing
      console.log("[monitor] empty — raw response keys:", Object.keys(json));
      if (json.error) console.log("[monitor] serper error:", json.error);
    }

    return organic;
  } catch (err) {
    console.error("[monitor] serperSearch fetch failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Build ICP-based search queries (simpler = more results) ──────────────────

function buildSearchQueries(): string[] {
  const industries = CLIENT_CONFIG.icpCriteria.targetIndustries.slice(0, 2);
  const titles     = CLIENT_CONFIG.icpCriteria.targetTitles.slice(0, 3);

  const titleStr    = titles.join(" OR ");
  const industryStr = industries.join(" OR ");

  return [
    // Simple title + industry — best for extracting named professionals
    `${titleStr} ${industryStr} company contact 2024`,
    // LinkedIn people results (no site: restriction — performs better)
    `linkedin ${titleStr} ${industryStr} profile`,
    // Company team / about pages
    `${industryStr} company "our team" OR "about us" ${titleStr} 2024`,
  ];
}

// ── LinkedIn URL → name fallback ──────────────────────────────────────────────

function extractFromLinkedInUrl(link: string): Partial<DiscoveredLead> | null {
  // Handles: https://www.linkedin.com/in/john-doe-12345678/
  const match = link.match(/linkedin\.com\/in\/([\w-]+)/i);
  if (!match) return null;

  const slug = match[1];
  // Strip trailing numeric IDs (e.g. "-a1b2c3d4")
  const parts = slug.split("-").filter((p) => p.length > 1 && !/^\d{6,}$/.test(p));
  if (parts.length < 2) return null;

  const name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  return { name, linkedin_url: link };
}

// ── Groq extraction ───────────────────────────────────────────────────────────

async function groqExtractLeads(
  results:      SerperResult[],
  targetTitles: readonly string[],
): Promise<DiscoveredLead[]> {
  if (results.length === 0) {
    console.log("[monitor] groqExtractLeads: no results to process");
    return [];
  }

  const snippets = results
    .slice(0, 20)
    .map((r, i) =>
      `[${i + 1}] TITLE: ${r.title}\nSNIPPET: ${r.snippet?.slice(0, 250) ?? "(none)"}\nURL: ${r.link ?? ""}`,
    )
    .join("\n\n");

  console.log("[monitor] groqExtractLeads: sending", results.length, "snippets to Groq");

  const prompt = `You are a B2B lead extraction AI. Extract real people with decision-making roles from these search results.

Target roles (prioritize): ${targetTitles.join(", ")}

EXTRACTION RULES:
- Include ANYONE clearly identified by name with a company association
- Be generous — if you can see a name, a company, and a plausible title, include the lead
- For LinkedIn URLs (linkedin.com/in/...), the slug usually encodes the person's name
- Title: use what you see, or infer from context (e.g. "LinkedIn profile" → look at snippet)
- email: set to null unless literally visible in the snippet
- linkedin_url: set to the full URL only if it's a linkedin.com/in/... link
- source: "LinkedIn", "company website", "news article", "directory", etc.

Search results:
${snippets}

Return ONLY valid JSON. Aim to extract every identifiable person — 5 to 15 leads if possible.
{"leads":[{"name":"Full Name","company":"Company Name","title":"Job Title","email":null,"linkedin_url":null,"source":"..."}]}`;

  try {
    const completion = await groq.chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{ role: "user", content: prompt }],
      temperature:     0.2,
      max_tokens:      2000,
      response_format: { type: "json_object" },
    });

    const raw    = completion.choices[0]?.message?.content ?? "{}";
    console.log("[monitor] Groq raw response (first 400 chars):", raw.slice(0, 400));

    const parsed = JSON.parse(raw);
    const leads  = Array.isArray(parsed.leads) ? parsed.leads : [];

    console.log("[monitor] Groq returned", leads.length, "lead objects");

    const valid = leads
      .filter((l: Partial<DiscoveredLead>) => {
        const ok = !!(l.name?.trim() && l.company?.trim());
        if (!ok) console.log("[monitor] Groq lead filtered (missing name/company):", JSON.stringify(l));
        return ok;
      })
      .map((l: Partial<DiscoveredLead>) => ({
        name:         (l.name         ?? "").trim(),
        company:      (l.company      ?? "Unknown").trim(),
        title:        (l.title        ?? "Professional").trim(),
        email:        l.email         ?? null,
        linkedin_url: l.linkedin_url  ?? null,
        source:       (l.source       ?? "web search").trim(),
      })) as DiscoveredLead[];

    console.log("[monitor] Groq valid leads:", valid.length);
    return valid;
  } catch (err) {
    console.error("[monitor] Groq extraction failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ── URL-based fallback extraction ─────────────────────────────────────────────

function urlFallbackExtraction(results: SerperResult[]): DiscoveredLead[] {
  const leads: DiscoveredLead[] = [];

  for (const result of results) {
    if (!result.link?.includes("linkedin.com/in/")) continue;

    const partial = extractFromLinkedInUrl(result.link);
    if (!partial?.name) continue;

    // Try to extract company from the title (common pattern: "Name - Title at Company | LinkedIn")
    let company = "Unknown";
    let title   = "Professional";

    const titleParts = result.title?.split(/[-–|·]/).map((s) => s.trim()) ?? [];
    if (titleParts.length >= 3) {
      // "John Doe - CEO at Acme Corp | LinkedIn"
      title   = titleParts[1] ?? title;
      company = titleParts[2]?.replace(/^\s*at\s+/i, "").replace(/ LinkedIn.*$/i, "") || company;
    } else if (titleParts.length === 2) {
      // "John Doe | LinkedIn" or "John Doe - Acme Corp"
      company = titleParts[1]?.replace(/ LinkedIn.*$/i, "") || company;
    }

    leads.push({
      name:         partial.name,
      company:      company.trim() || "Unknown",
      title:        title.trim()   || "Professional",
      email:        null,
      linkedin_url: result.link,
      source:       "LinkedIn",
    });
  }

  console.log("[monitor] URL fallback extracted", leads.length, "LinkedIn leads");
  return leads;
}

// ── Extract leads: Groq + URL fallback, merged ────────────────────────────────

async function extractLeadsFromResults(
  results:      SerperResult[],
  targetTitles: readonly string[],
): Promise<DiscoveredLead[]> {
  console.log("[monitor] extractLeadsFromResults: total raw results:", results.length);
  if (results.length === 0) return [];

  const [groqLeads, urlLeads] = await Promise.all([
    groqExtractLeads(results, targetTitles),
    Promise.resolve(urlFallbackExtraction(results)),
  ]);

  // Merge: prefer Groq leads; add URL leads only if no Groq lead already has that linkedin_url
  const groqUrls = new Set(groqLeads.map((l) => l.linkedin_url).filter(Boolean));
  const extra    = urlLeads.filter((l) => !l.linkedin_url || !groqUrls.has(l.linkedin_url));

  const merged = [...groqLeads, ...extra];
  console.log("[monitor] Merged leads (Groq + URL fallback):", merged.length);
  return merged;
}

// ── Deduplication — email-only check ─────────────────────────────────────────

async function deduplicateLeads(
  candidates: DiscoveredLead[],
  userId:     string,
  supabase:   ReturnType<typeof createAdminClient>,
): Promise<DiscoveredLead[]> {
  if (candidates.length === 0) return [];

  // Only fetch emails — skip name+company check (too aggressive, causes false positives)
  const { data: existing } = await supabase
    .from("leads")
    .select("email")
    .eq("user_id", userId);

  const existingEmails = new Set(
    (existing ?? [])
      .map((l) => l.email?.toLowerCase().trim())
      .filter((e): e is string => !!e && e !== "unknown@unknown.com"),
  );

  console.log("[monitor] deduplicateLeads: DB has", existingEmails.size, "known emails");

  const newLeads = candidates.filter((c) => {
    // Skip only on exact email match (ignore null / placeholder emails)
    if (c.email && c.email !== "unknown@unknown.com") {
      const norm = c.email.toLowerCase().trim();
      if (existingEmails.has(norm)) {
        console.log("[monitor] dedup skip (email match):", c.name, c.email);
        return false;
      }
    }
    return true;
  });

  console.log("[monitor] deduplicateLeads:", candidates.length, "candidates →", newLeads.length, "new");
  return newLeads;
}

// ── Core discovery (shared by GET and POST) ───────────────────────────────────

async function discoverLeads(
  userId:  string,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<DiscoveredLead[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    console.warn("[monitor] SERPER_API_KEY not configured — cannot discover leads");
    return [];
  }

  const queries = buildSearchQueries();
  console.log("[monitor] discoverLeads: running", queries.length, "searches");
  queries.forEach((q, i) => console.log(`[monitor]   query[${i}]:`, q));

  // Run all searches in parallel
  const searchBatches  = await Promise.all(queries.map((q) => serperSearch(q, serperKey)));
  const allResults     = searchBatches.flat();
  console.log("[monitor] Total raw Serper results:", allResults.length);

  if (allResults.length === 0) {
    console.warn("[monitor] All searches returned 0 results — check SERPER_API_KEY and query format");
    return [];
  }

  // Log all raw results for debugging
  allResults.forEach((r, i) =>
    console.log(`[monitor] raw[${i}]:`, r.title?.slice(0, 80), "|", r.link?.slice(0, 60)),
  );

  const extracted = await extractLeadsFromResults(allResults, CLIENT_CONFIG.icpCriteria.targetTitles);
  console.log("[monitor] Extracted before dedup:", extracted.length);
  extracted.forEach((l) =>
    console.log(`[monitor]   candidate: ${l.name} | ${l.title} @ ${l.company} | email:${l.email ?? "null"}`),
  );

  const deduped = await deduplicateLeads(extracted, userId, supabase);
  console.log("[monitor] Final new leads after dedup:", deduped.length);

  return deduped;
}

// ── GET — discover leads (read-only) ─────────────────────────────────────────

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

// ── POST — discover + import + score ─────────────────────────────────────────

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

  const supabase  = createAdminClient();
  const newLeads  = await discoverLeads(user.id, supabase);

  console.log("[monitor] POST autoImport: will import", newLeads.length, "leads");

  if (newLeads.length === 0) {
    return NextResponse.json({
      found:    0,
      imported: 0,
      hot:      0,
      warm:     0,
      cold:     0,
      message:  "No new leads discovered. Check server logs for Serper/Groq debug info.",
      details:  [],
    });
  }

  type ImportResult = { name: string; company: string; score: number; status: string; source: string };
  const details: ImportResult[] = [];

  for (const candidate of newLeads.slice(0, 15)) {
    console.log("[monitor] Importing:", candidate.name, "|", candidate.title, "@", candidate.company);

    try {
      // Score with AI
      const scored = await scoreLeadWithAI({
        name:         candidate.name,
        email:        candidate.email ?? "",
        company:      candidate.company,
        title:        candidate.title,
        linkedin_url: candidate.linkedin_url,
      });

      console.log("[monitor] Scored", candidate.name, "→", scored.score, scored.status);

      // Insert directly via admin client
      const row = {
        user_id:      user.id,
        name:         candidate.name,
        email:        candidate.email || null,
        company:      candidate.company || null,
        title:        candidate.title   || null,
        linkedin_url: candidate.linkedin_url || null,
        phone:        null,
        score:        scored.score,
        score_reason: scored.reasoning,
        client_id:    null,
        // status must match LeadStatus — cast via as any to bypass Supabase strict typing
        status:       scored.status,
      };

      console.log("[monitor] Inserting row:", JSON.stringify(row));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error: insertErr } = await supabase
        .from("leads")
        .insert(row as any)
        .select("id")
        .single();

      if (insertErr) {
        console.error(
          "[monitor] Insert FAILED for", candidate.name,
          "| code:", insertErr.code,
          "| message:", insertErr.message,
          "| details:", insertErr.details,
          "| hint:", insertErr.hint,
        );
        continue;
      }

      console.log("[monitor] Insert SUCCESS:", candidate.name, "id:", inserted?.id);

      details.push({
        name:    candidate.name,
        company: candidate.company,
        score:   scored.score,
        status:  scored.status,
        source:  candidate.source,
      });
    } catch (err) {
      console.error("[monitor] Unexpected error for", candidate.name, ":", err instanceof Error ? err.message : err);
    }
  }

  const result = {
    found:    newLeads.length,
    imported: details.length,
    hot:      details.filter((d) => d.status === "hot").length,
    warm:     details.filter((d) => d.status === "warm").length,
    cold:     details.filter((d) => d.status === "cold").length,
    details,
  };

  console.log("[monitor] POST complete:", JSON.stringify({ found: result.found, imported: result.imported, hot: result.hot, warm: result.warm, cold: result.cold }));
  return NextResponse.json(result);
}

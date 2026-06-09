import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// ── Types ──────────────────────────────────────────────────────────────────────

interface SerperSearchBody {
  jobTitle:   string;
  industry?:  string;
  location?:  string;
  domain?:    string;
  limit?:     number;
}

interface EmailEnrichBody {
  leads: ProspectLead[];
}

export interface ProspectLead {
  name:         string;
  email:        string;
  company:      string;
  title:        string;
  confidence:   number;
  type:         "personal" | "generic";
  linkedin_url: string | null;
}

interface SerperOrganicResult {
  title:    string;
  snippet?: string;
  link:     string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SERPER_URL        = "https://google.serper.dev/search";
const EMAIL_CONCURRENCY = 5;

const JOB_LISTING_WORDS = [
  "jobs", "job", "hiring", "careers", "career", "vacancy", "vacancies",
  "opening", "openings", "apply", "recruitment", "position", "positions",
  "opportunity", "opportunities", "indeed", "glassdoor", "ziprecruiter",
  "monster", "simplyhired",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractEmails(text: string): string[] {
  return Array.from(new Set(text.match(/[\w.\-+]+@[\w.\-]+\.\w{2,}/g) ?? []));
}

function looksLikePersonName(name: string): boolean {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return false;
  if (parts.some((p) => p.length > 20)) return false;
  if (!parts.every((p) => /^[A-ZÀ-ɏ]/.test(p))) return false;
  const lower = name.toLowerCase();
  if (JOB_LISTING_WORDS.some((w) => lower.includes(w))) return false;
  return true;
}

function parseResult(
  rawTitle: string,
  snippet:  string,
  link:     string
): {
  name:         string;
  jobTitle:     string;
  company:      string;
  emails:       string[];
  linkedin_url: string | null;
} | null {
  const isLinkedIn = link.includes("linkedin.com/in/");

  const clean = rawTitle
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .replace(/\s*[-|]\s*LinkedIn\s*$/i, "")
    .replace(/\s*\|\s*[\w\s]+Profile\s*$/i, "")
    .trim();

  let name    = "";
  let title   = "";
  let company = "";

  const dashMatch = clean.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) {
    name          = dashMatch[1].trim();
    const rest    = dashMatch[2].trim();
    const atMatch = rest.match(/^(.+?)\s+at\s+(.+)$/i);
    if (atMatch) {
      title   = atMatch[1].trim();
      company = atMatch[2].trim();
    } else {
      title = rest;
    }
  } else {
    name = clean;
  }

  if (!looksLikePersonName(name)) return null;

  const emails = Array.from(new Set([...extractEmails(snippet), ...extractEmails(link)]));

  return {
    name,
    jobTitle:     title,
    company,
    emails:       Array.from(new Set(emails)),
    linkedin_url: isLinkedIn ? link : null,
  };
}

// Runs tasks with at most `concurrency` in-flight at once
async function pLimit<T>(
  tasks:       (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const i   = next++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, worker)
  );
  return results;
}

// Best-guess domain from a company name (heuristic only)
function companyToDomain(company: string): string {
  return (
    company
      .toLowerCase()
      .replace(
        /\b(inc|llc|ltd|corp|co|company|group|technologies|tech|solutions|services|international|global)\b\.?/gi,
        ""
      )
      .replace(/[^a-z0-9]/g, "")
      .trim() + ".com"
  );
}

// Runs 2–3 targeted Serper queries to find an email for a single lead
async function findEmailForLead(
  lead:          ProspectLead,
  serperHeaders: Record<string, string>
): Promise<string> {
  const queries: string[] = [
    `"${lead.name}" "${lead.company}" email contact`.trim(),
    `"${lead.name}" email "@"`,
  ];

  if (lead.company) {
    const domain = companyToDomain(lead.company);
    queries.push(
      `"${lead.name}" site:${domain} OR "${lead.name}" "${lead.company}" email`
    );
  }

  const responses = await Promise.all(
    queries.map((q) =>
      fetch(SERPER_URL, {
        method:  "POST",
        headers: serperHeaders,
        body:    JSON.stringify({ q, num: 5 }),
      })
        .then((r) => r.json() as Promise<SerperResponse>)
        .catch(() => ({ organic: [] } as SerperResponse))
    )
  );

  for (const response of responses) {
    for (const item of response.organic ?? []) {
      const emails = extractEmails(
        `${item.title} ${item.snippet ?? ""} ${item.link}`
      );
      if (emails.length > 0) return emails[0];
    }
  }

  return "";
}

// Enriches email in-place for every lead that currently has none; max EMAIL_CONCURRENCY at once
async function enrichEmails(
  leads:         ProspectLead[],
  serperHeaders: Record<string, string>
): Promise<void> {
  const missing = leads.filter((l) => !l.email);
  if (missing.length === 0) return;

  await pLimit(
    missing.map((lead) => async () => {
      const email = await findEmailForLead(lead, serperHeaders);
      if (email) {
        const target = leads.find((l) => l.name === lead.name);
        if (target) {
          target.email      = email;
          target.confidence = 60; // enriched after the fact — slightly lower confidence
        }
      }
    }),
    EMAIL_CONCURRENCY
  );
}

// ── POST: Lead search + auto email enrichment ─────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "SERPER_API_KEY must be configured" },
      { status: 500 }
    );
  }

  let body: SerperSearchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobTitle, industry, location, limit = 25 } = body;

  if (!jobTitle?.trim()) {
    return NextResponse.json({ error: "jobTitle is required" }, { status: 400 });
  }

  const fetchLimit = Math.min(Math.max(1, Number(limit) || 25), 50);
  const jt  = jobTitle.trim();
  const ind = industry?.trim() ?? "";
  const loc = location?.trim() ?? "";

  const queries = [
    `"${jt}" "${ind}" ${loc} linkedin.com/in`.trim(),
    `"${jt}" ${ind} ${loc} email contact`.trim(),
    `${ind} "${jt}" ${loc} "@gmail.com" OR "@outlook.com"`.trim(),
    `site:linkedin.com/in "${jt}" "${ind}" ${loc}`.trim(),
  ];

  const serperHeaders = {
    "X-API-KEY":    apiKey,
    "Content-Type": "application/json",
  };

  // Phase 1: 4 parallel lead-discovery queries
  const searchResults = await Promise.all(
    queries.map((q) =>
      fetch(SERPER_URL, {
        method:  "POST",
        headers: serperHeaders,
        body:    JSON.stringify({ q, num: 10 }),
      })
        .then((r) => r.json() as Promise<SerperResponse>)
        .catch(() => ({ organic: [] } as SerperResponse))
    )
  );

  const organic: SerperOrganicResult[] = searchResults.flatMap(
    (r) => r.organic ?? []
  );

  const seen = new Map<string, ProspectLead>();

  for (const item of organic) {
    const parsed = parseResult(item.title, item.snippet ?? "", item.link);
    if (!parsed) continue;

    const key = parsed.name.toLowerCase();

    if (seen.has(key)) {
      const existing = seen.get(key)!;
      if (!existing.email        && parsed.emails[0])    existing.email        = parsed.emails[0];
      if (!existing.linkedin_url && parsed.linkedin_url) existing.linkedin_url = parsed.linkedin_url;
      if (!existing.company      && parsed.company)      existing.company      = parsed.company;
      if (!existing.title        && parsed.jobTitle)     existing.title        = parsed.jobTitle;
      continue;
    }

    seen.set(key, {
      name:         parsed.name,
      email:        parsed.emails[0] ?? "",
      company:      parsed.company,
      title:        parsed.jobTitle || jt,
      confidence:   70,
      type:         "personal",
      linkedin_url: parsed.linkedin_url,
    });
  }

  const leads = Array.from(seen.values()).slice(0, fetchLimit);

  // Phase 2: enrich emails for leads that came back without one
  await enrichEmails(leads, serperHeaders);

  return NextResponse.json({ leads, total: leads.length });
}

// ── PUT: Standalone email enrichment for already-found leads ──────────────────

export async function PUT(req: NextRequest) {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "SERPER_API_KEY must be configured" },
      { status: 500 }
    );
  }

  let body: EmailEnrichBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.leads)) {
    return NextResponse.json({ error: "leads array is required" }, { status: 400 });
  }

  // Clone so we mutate our copy, not the caller's object
  const leads: ProspectLead[] = body.leads.map((l) => ({ ...l }));

  const serperHeaders = {
    "X-API-KEY":    apiKey,
    "Content-Type": "application/json",
  };

  await enrichEmails(leads, serperHeaders);

  return NextResponse.json({ leads });
}

import { NextRequest, NextResponse } from "next/server";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApolloSearchBody {
  jobTitle:     string;
  industry?:    string;
  location?:    string;
  companySize?: string;
  limit?:       number;
}

export interface ProspectLead {
  name:         string;
  email:        string | null;
  company:      string;
  title:        string;
  linkedin_url: string | null;
  phone:        string | null;
}

interface ApolloPerson {
  name:          string;
  title:         string | null;
  email:         string | null;
  email_status:  string | null;
  linkedin_url:  string | null;
  phone_numbers?: Array<{ raw_number: string }>;
  organization?: { name: string } | null;
}

interface ApolloResponse {
  people:     ApolloPerson[];
  pagination: { page: number; per_page: number; total_entries: number; total_pages: number };
}

// Maps UI company size labels → Apollo employee range filter strings
const COMPANY_SIZE_RANGES: Record<string, string[]> = {
  "1-10":    ["1,10"],
  "11-50":   ["11,50"],
  "51-200":  ["51,200"],
  "201-500": ["201,500"],
  "500+":    ["500,10000"],
};

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });
  }

  let body: ApolloSearchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobTitle, industry, location, companySize, limit = 25 } = body;

  if (!jobTitle?.trim()) {
    return NextResponse.json({ error: "jobTitle is required" }, { status: 400 });
  }

  const perPage = Math.min(Math.max(1, Number(limit) || 25), 50);

  const payload: Record<string, unknown> = {
    person_titles:           [jobTitle.trim()],
    contact_email_status_v2: ["verified", "likely_to_engage"],
    page:                    1,
    per_page:                perPage,
  };

  if (location?.trim())   payload.person_locations           = [location.trim()];
  if (industry?.trim())   payload.q_organization_industries  = [industry.trim()];
  if (companySize && COMPANY_SIZE_RANGES[companySize]) {
    payload.organization_num_employees_ranges = COMPANY_SIZE_RANGES[companySize];
  }

  const apolloRes = await fetch("https://api.apollo.io/v1/mixed_people/search", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "X-Api-Key":     apiKey,
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(payload),
  });

  if (!apolloRes.ok) {
    const text = await apolloRes.text();
    return NextResponse.json(
      { error: `Apollo API ${apolloRes.status}: ${text}` },
      { status: apolloRes.status }
    );
  }

  const data = (await apolloRes.json()) as ApolloResponse;
  const people = data.people ?? [];

  const leads: ProspectLead[] = people.map((p) => ({
    name:         p.name,
    email:        p.email ?? null,
    company:      p.organization?.name ?? "",
    title:        p.title ?? "",
    linkedin_url: p.linkedin_url ?? null,
    phone:        p.phone_numbers?.[0]?.raw_number ?? null,
  }));

  return NextResponse.json({
    leads,
    total: data.pagination?.total_entries ?? leads.length,
  });
}

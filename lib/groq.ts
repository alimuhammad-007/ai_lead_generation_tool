import Groq from "groq-sdk";

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeadScoringInput = {
  id?: string;
  name: string;
  email: string;
  company: string;
  title: string;
  linkedin_url?: string | null;
};

export type ScoreBreakdown = {
  title_score: number;    // 0–35  seniority / decision-making authority
  company_score: number;  // 0–25  company size & brand credibility
  industry_score: number; // 0–25  industry fit for B2B SaaS
  email_score: number;    // 0–15  email domain quality
};

export type LeadScoringResult = {
  score: number;                     // 0–100 (sum of breakdown, clamped)
  status: "hot" | "warm" | "cold";  // ≥70 hot, 40–69 warm, <40 cold
  reasoning: string;
  breakdown: ScoreBreakdown;
};

// ---------------------------------------------------------------------------
// Email domain classifier (pre-computed, no LLM needed)
// ---------------------------------------------------------------------------

const FREE_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "aol.com", "protonmail.com", "zohomail.com", "mail.com", "ymail.com",
  "live.com", "msn.com", "me.com", "mac.com", "googlemail.com",
]);

type EmailKind = "corporate" | "free" | "unknown";

function classifyEmail(email: string): EmailKind {
  if (!email?.includes("@")) return "unknown";
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return "unknown";
  return FREE_DOMAINS.has(domain) ? "free" : "corporate";
}

// ---------------------------------------------------------------------------
// Prompt factory
// ---------------------------------------------------------------------------

function buildPrompt(lead: LeadScoringInput): string {
  const emailKind = classifyEmail(lead.email);
  return `You are a senior B2B SaaS sales analyst scoring inbound leads.

Lead:
  Name:     ${lead.name}
  Email:    ${lead.email}  [domain type: ${emailKind}]
  Company:  ${lead.company}
  Title:    ${lead.title}
  LinkedIn: ${lead.linkedin_url ?? "not provided"}

Score this lead across FOUR dimensions. Use the exact rubric below — pick the
closest tier and return the integer listed for that tier.

────────────────────────────────────────────────────────────────
DIMENSION 1 — title_score   (integer, 0–35)
────────────────────────────────────────────────────────────────
35 → C-suite: CEO, CTO, CFO, COO, CMO, CISO, CPO, CRO, or equivalent
28 → Founder / Co-Founder / President / Managing Director / Partner
22 → VP / Vice President / SVP / EVP (any department)
16 → Director / Head of [department]
12 → Senior Manager / Principal / Staff / Lead [role]
 8 → Manager / Team Lead
 4 → Senior IC: Sr. Engineer, Sr. Analyst, Sr. Designer, etc.
 1 → IC / Associate / Coordinator / EA / Intern / Student / unknown

────────────────────────────────────────────────────────────────
DIMENSION 2 — company_score  (integer, 0–25)
────────────────────────────────────────────────────────────────
25 → Instantly recognisable enterprise (Fortune 500, FAANG, Salesforce, etc.)
20 → Well-known mid-to-large company (500+ employees, strong regional brand)
13 → Credible funded SMB or startup (50–499 employees, real product/customers)
 6 → Early-stage or unrecognised startup (< 50 employees)
 1 → Freelancer / solo operator / personal brand / completely unknown name

────────────────────────────────────────────────────────────────
DIMENSION 3 — industry_score (integer, 0–25)
────────────────────────────────────────────────────────────────
25 → Perfect fit: SaaS / Cloud / FinTech / HR Tech / MarTech / DevTools / CyberSecurity
20 → Strong fit:  Finance / Banking / Insurance / HealthTech / E-commerce / PropTech
13 → Moderate fit: Consulting / Professional Services / Media / Logistics / Retail
 6 → Weak fit:    Education / Healthcare (non-tech) / Manufacturing / Hospitality
 1 → Low fit:     Government / Non-profit / Agriculture / Construction

────────────────────────────────────────────────────────────────
DIMENSION 4 — email_score    (integer, 0–15)
────────────────────────────────────────────────────────────────
15 → Corporate domain that matches (or clearly belongs to) the company name
10 → Any non-free business email (domain doesn't obviously match, but not a free provider)
 3 → Free email provider (Gmail / Yahoo / Hotmail / iCloud / Outlook.com / etc.)
 0 → Missing, malformed, or obviously fake

────────────────────────────────────────────────────────────────

Return ONLY this JSON — no markdown, no code fences, no extra text:
{
  "title_score":    <integer>,
  "company_score":  <integer>,
  "industry_score": <integer>,
  "email_score":    <integer>,
  "reasoning": "<one sharp sentence naming the 2–3 signals that most influenced the score>"
}`;
}

// ---------------------------------------------------------------------------
// Core scoring function
// ---------------------------------------------------------------------------

export async function scoreLeadWithAI(
  lead: LeadScoringInput
): Promise<LeadScoringResult> {
  let raw = "{}";
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: buildPrompt(lead) }],
      temperature: 0.1,  // near-deterministic for consistent scoring
      max_tokens: 256,
      response_format: { type: "json_object" },
    });
    raw = completion.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    console.error("[groq] API call failed for lead:", lead.email, err);
    return heuristicFallback(lead);
  }

  let parsed: Partial<{
    title_score: number;
    company_score: number;
    industry_score: number;
    email_score: number;
    reasoning: string;
  }>;

  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[groq] JSON parse failed:", raw);
    return heuristicFallback(lead);
  }

  const breakdown: ScoreBreakdown = {
    title_score:    clamp(Number(parsed.title_score    ?? 0), 0, 35),
    company_score:  clamp(Number(parsed.company_score  ?? 0), 0, 25),
    industry_score: clamp(Number(parsed.industry_score ?? 0), 0, 25),
    email_score:    clamp(Number(parsed.email_score    ?? 0), 0, 15),
  };

  // We sum the dimensions ourselves — never trust the model's arithmetic
  const score =
    breakdown.title_score +
    breakdown.company_score +
    breakdown.industry_score +
    breakdown.email_score;

  return {
    score,
    status: deriveStatus(score),
    reasoning: parsed.reasoning?.trim() || "No reasoning returned by model.",
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// Batch scoring with concurrency cap
// Groq free tier: 30 RPM for llama-3.3-70b-versatile → cap at 5 concurrent
// ---------------------------------------------------------------------------

export async function scoreBatchWithAI(
  leads: LeadScoringInput[],
  concurrency = 5
): Promise<Array<LeadScoringResult & { id?: string }>> {
  const results: Array<LeadScoringResult & { id?: string }> = new Array(
    leads.length
  );
  let cursor = 0;

  // Worker: keeps pulling the next available lead until all are done.
  // cursor++ is atomic in JS's single-threaded model — no race condition.
  async function worker(): Promise<void> {
    while (cursor < leads.length) {
      const i = cursor++;
      const result = await scoreLeadWithAI(leads[i]);
      results[i] = { ...result, id: leads[i].id };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, leads.length) }, () => worker())
  );

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveStatus(score: number): "hot" | "warm" | "cold" {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, isNaN(n) ? min : n));
}

/** Minimal heuristic score when Groq is unavailable — never surfaces as scored. */
function heuristicFallback(lead: LeadScoringInput): LeadScoringResult {
  const emailScore = classifyEmail(lead.email) === "corporate" ? 10 : 3;
  const score = emailScore;
  return {
    score,
    status: deriveStatus(score),
    reasoning: "Fallback score — Groq API was unreachable. Re-score when available.",
    breakdown: {
      title_score: 0,
      company_score: 0,
      industry_score: 0,
      email_score: emailScore,
    },
  };
}

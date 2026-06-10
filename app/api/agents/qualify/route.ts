import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { scoreLeadWithAI, groq } from "@/lib/groq";
import { generateEmail, bodyToHtml } from "@/lib/emailGenerator";
import { CLIENT_CONFIG } from "@/lib/config";
import type { EmailAngle } from "@/lib/emailGenerator";
import type { Lead, LeadResearch } from "@/types/database";

// Vercel Pro supports up to 300 s — cap batch at 20 leads to stay safe.
export const maxDuration = 300;

// ── Standard sequence steps (Day 1·3·7·14) ────────────────────────────────────

const STANDARD_STEPS: Array<{ day: number; offset: number; angle: EmailAngle; }> = [
  { day:  1, offset:  0, angle: "introduction"      },
  { day:  3, offset:  2, angle: "value_proposition" },
  { day:  7, offset:  6, angle: "social_proof"      },
  { day: 14, offset: 13, angle: "breakup"            },
];

// ── Serper ─────────────────────────────────────────────────────────────────────

const SERPER_URL = "https://google.serper.dev/search";

async function serperSearch(q: string, apiKey: string) {
  try {
    const r = await fetch(SERPER_URL, {
      method:  "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body:    JSON.stringify({ q, num: 4 }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((await r.json()).organic ?? []) as Array<{ title: string; snippet?: string }>;
  } catch { return []; }
}

// ── Fast ICP match (rule-based, no Groq call) ─────────────────────────────────

function fastIcpScore(lead: { title: string | null; email: string | null }): {
  score: number;
  match: "perfect" | "good" | "poor";
} {
  const titleLower = (lead.title ?? "").toLowerCase();
  const isCorporate =
    lead.email &&
    !["gmail", "yahoo", "hotmail", "outlook", "icloud"].some((d) =>
      lead.email!.includes(d)
    );

  const titleScore =
    CLIENT_CONFIG.icpCriteria.targetTitles.some((t) =>
      titleLower.includes(t.toLowerCase())
    )
      ? 40
      : titleLower.match(/director|head|lead|principal|staff/i)
      ? 25
      : 10;

  const emailScore = isCorporate ? 15 : 8;
  const total      = Math.min(100, titleScore + emailScore + 30 + 10); // 30 industry assumed, 10 data quality
  return {
    score: total,
    match: total >= 75 ? "perfect" : total >= 45 ? "good" : "poor",
  };
}

// ── Start standard email sequence ─────────────────────────────────────────────

async function startStandardSequence(
  lead:    { id: string; name: string; company: string | null; title: string | null },
  userId:  string,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<number> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const base   = Date.now();

  const rows = await Promise.all(
    STANDARD_STEPS.map(async (step) => {
      let gen: { subject: string; body: string };
      try {
        gen = await generateEmail({
          name:    lead.name,
          company: lead.company ?? "",
          title:   lead.title   ?? "",
          angle:   step.angle,
        });
      } catch { return null; }

      const tracking_id    = randomUUID();
      const scheduled_for  = new Date(base + step.offset * 86_400_000).toISOString();
      return {
        user_id:       userId,
        lead_id:       lead.id,
        campaign_id:   null,
        sequence_day:  step.day,
        subject:       gen.subject,
        body:          gen.body,
        html:          bodyToHtml(gen.body, `${appUrl}/api/outreach/track?id=${tracking_id}`),
        status:        "scheduled" as const,
        tracking_id,
        scheduled_for,
      };
    })
  );

  const valid = rows.filter(Boolean) as NonNullable<(typeof rows)[number]>[];
  if (valid.length === 0) return 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("outreach_emails").insert(valid as any);
  return error ? 0 : valid.length;
}

// ── Lightweight research (2 searches + Groq) ──────────────────────────────────

async function quickResearch(
  lead: { name: string; company: string; title: string },
  serperKey: string,
): Promise<LeadResearch | null> {
  const company = lead.company || "Unknown Company";
  const [news, biz] = await Promise.all([
    serperSearch(`"${company}" news 2024 2025`, serperKey),
    serperSearch(`"${company}" funding OR growth OR expansion`, serperKey),
  ]);

  const ctx = [...news, ...biz]
    .slice(0, 8)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet?.slice(0, 120) ?? ""}`)
    .join("\n\n");

  try {
    const completion = await groq.chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{
        role:    "user",
        content: `Brief for ${lead.name} at ${company}.\n\n${ctx}\n\nJSON: {"company_summary":"...","recent_news":"...","pain_points":"...","talking_points":["...","...","..."],"best_outreach_angle":"..."}`,
      }],
      temperature:     0.4,
      max_tokens:      600,
      response_format: { type: "json_object" },
    });
    const p = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return {
      company_summary:     p.company_summary     ?? "",
      recent_news:         p.recent_news         ?? "",
      pain_points:         p.pain_points         ?? "",
      talking_points:      Array.isArray(p.talking_points) ? p.talking_points as string[] : [],
      best_outreach_angle: p.best_outreach_angle ?? "",
      researched_at:       new Date().toISOString(),
    };
  } catch { return null; }
}

// ── Process a single lead ─────────────────────────────────────────────────────

interface QualifyResult {
  id:              string;
  name:            string;
  score:           number;
  status:          string;
  icpScore:        number;
  icpMatch:        string;
  sequenceStarted: boolean;
  alerted:         boolean;
  researched:      boolean;
}

async function qualifyOneLead(
  lead:      Lead,
  userId:    string,
  supabase:  ReturnType<typeof createAdminClient>,
  serperKey: string,
): Promise<QualifyResult> {
  // 1 ── AI lead scoring
  const scoreResult = await scoreLeadWithAI({
    id:          lead.id,
    name:        lead.name,
    email:       lead.email ?? "",
    company:     lead.company ?? "",
    title:       lead.title   ?? "",
    linkedin_url: lead.linkedin_url,
  });

  // 2 ── ICP scoring (fast, no extra Groq call)
  const icp = fastIcpScore({ title: lead.title, email: lead.email });

  // 3 ── Persist scores
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.from("leads").update({
    score:        scoreResult.score,
    status:       scoreResult.status,
    score_reason: scoreResult.reasoning,
    icp_score:    icp.score,
  } as any).eq("id", lead.id);

  let alerted         = false;
  let sequenceStarted = false;
  let researched      = false;

  // 4 ── Hot lead → stamp alerted_at so alert banner shows it
  if (scoreResult.status === "hot") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("leads").update({ alerted_at: null } as any).eq("id", lead.id);
    alerted = true;
    console.log("[qualify] Hot lead flagged:", lead.name);
  }

  // 5 ── Score ≥ 70 with real email → start standard sequence (if none exists)
  const hasRealEmail = lead.email && lead.email !== "unknown@unknown.com";
  if (scoreResult.score >= 70 && hasRealEmail) {
    const { count } = await supabase
      .from("outreach_emails")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .eq("status", "scheduled");

    if (!count || count === 0) {
      const started = await startStandardSequence(
        { id: lead.id, name: lead.name, company: lead.company, title: lead.title },
        userId,
        supabase,
      );
      sequenceStarted = started > 0;
      console.log("[qualify] Sequence started for:", lead.name, "emails:", started);
    }
  }

  // 6 ── Quick research (only if Serper configured and lead has no research)
  if (serperKey && !lead.research) {
    const research = await quickResearch(
      { name: lead.name, company: lead.company ?? "Unknown", title: lead.title ?? "" },
      serperKey,
    );
    if (research) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("leads").update({ research } as any).eq("id", lead.id);
      researched = true;
    }
  }

  return {
    id:              lead.id,
    name:            lead.name,
    score:           scoreResult.score,
    status:          scoreResult.status,
    icpScore:        icp.score,
    icpMatch:        icp.match,
    sequenceStarted,
    alerted,
    researched,
  };
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { leadId?: string; runAll?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase  = createAdminClient();
  const serperKey = process.env.SERPER_API_KEY ?? "";

  let leadsToQualify: Lead[] = [];

  if (body.leadId) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", body.leadId)
      .eq("user_id", user.id)
      .single();
    if (error || !data) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    leadsToQualify = [data as Lead];

  } else if (body.runAll) {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "unscored")
      .order("created_at", { ascending: true })
      .limit(20); // Safety cap — rerun for more
    leadsToQualify = (data as Lead[]) ?? [];

  } else {
    return NextResponse.json({ error: "leadId or runAll:true required" }, { status: 400 });
  }

  if (leadsToQualify.length === 0) {
    return NextResponse.json({
      qualified:        0,
      hot:              0,
      warm:             0,
      cold:             0,
      sequencesStarted: 0,
      researched:       0,
      message:          "No unscored leads to qualify",
      details:          [],
    });
  }

  console.log("[qualify] Processing", leadsToQualify.length, "leads for user:", user.id);

  // Process sequentially to respect Groq rate limits
  const details: QualifyResult[] = [];
  for (const lead of leadsToQualify) {
    try {
      const result = await qualifyOneLead(lead, user.id, supabase, serperKey);
      details.push(result);
    } catch (err) {
      console.error("[qualify] Error processing lead", lead.id, ":", err);
      details.push({
        id: lead.id, name: lead.name, score: 0, status: "unscored",
        icpScore: 0, icpMatch: "poor", sequenceStarted: false, alerted: false, researched: false,
      });
    }
  }

  return NextResponse.json({
    qualified:        details.length,
    hot:              details.filter((d) => d.status === "hot").length,
    warm:             details.filter((d) => d.status === "warm").length,
    cold:             details.filter((d) => d.status === "cold").length,
    sequencesStarted: details.filter((d) => d.sequenceStarted).length,
    researched:       details.filter((d) => d.researched).length,
    details,
  });
}

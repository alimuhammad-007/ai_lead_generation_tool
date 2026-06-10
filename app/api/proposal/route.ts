import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { groq } from "@/lib/groq";
import { CLIENT_CONFIG } from "@/lib/config";
import type { LeadResearch } from "@/types/database";

// ── Prompt ─────────────────────────────────────────────────────────────────────

function buildPrompt(
  lead: { name: string; title: string | null; company: string | null },
  research: LeadResearch | null
): string {
  const tiers = CLIENT_CONFIG.pricingTiers
    .map(
      (t) =>
        `- **${t.name}** (${t.price}): ${t.features.slice(0, 3).join(", ")}`
    )
    .join("\n");

  const researchBlock = research
    ? `
COMPANY RESEARCH (use to personalize):
- Company Overview: ${research.company_summary}
- Recent News:      ${research.recent_news}
- Pain Points:      ${research.pain_points}
- Best Angle:       ${research.best_outreach_angle}`
    : `COMPANY RESEARCH: Not available — use general industry knowledge.`;

  return `You are a senior B2B consultant writing a professional, personalized sales proposal.

PROSPECT:
- Name:    ${lead.name}
- Title:   ${lead.title   ?? "Decision Maker"}
- Company: ${lead.company ?? "their company"}
${researchBlock}

OUR COMPANY: ${CLIENT_CONFIG.companyName} — ${CLIENT_CONFIG.companyTagline}

OUR SERVICES:
1. AI Lead Scoring & Prioritization
2. Automated Personalized Email Outreach
3. LinkedIn & Google Maps Prospecting
4. Follow-up Sequence Automation (14-day multi-touch)
5. Lead Research & Company Intelligence
6. CRM & Workflow Integration

PRICING PACKAGES:
${tiers}

Write a professional business proposal in Markdown with exactly these sections:
1. # Proposal for [Company Name]
2. ## Executive Summary (2-3 sentences — compelling value hook)
3. ## Problem Statement (2-4 bullet points based on pain points; be specific to their role/industry)
4. ## Proposed Solution (2-3 paragraphs — how our services solve their specific problems)
5. ## Services Included (bulleted list of relevant services with one-line descriptions)
6. ## Investment (table or list of the three pricing tiers with key features)
7. ## Why ${CLIENT_CONFIG.companyName}? (3 bullet points — differentiators)
8. ## Next Steps (3 numbered action steps — keep them simple and low-friction)

Style: confident but not pushy, specific over generic, professional. Total length: 500-700 words.
Return ONLY the markdown — no preamble, no commentary, no code fences.`;
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const serverClient = createServerSupabaseClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { leadId?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ── Fetch lead + research ──────────────────────────────────────────────────
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, name, title, company, user_id, research")
    .eq("id", body.leadId)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (lead.user_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // ── Generate proposal with Groq ────────────────────────────────────────────
  let proposal = "";
  try {
    const completion = await groq.chat.completions.create({
      model:       "llama-3.3-70b-versatile",
      messages:    [{ role: "user", content: buildPrompt(lead, lead.research as LeadResearch | null) }],
      temperature: 0.5,
      max_tokens:  2048,
    });
    proposal = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[proposal] Groq error:", err);
    return NextResponse.json({ error: "Proposal generation failed — Groq unavailable" }, { status: 502 });
  }

  if (!proposal) {
    return NextResponse.json({ error: "Empty proposal returned by AI" }, { status: 502 });
  }

  return NextResponse.json({ proposal });
}

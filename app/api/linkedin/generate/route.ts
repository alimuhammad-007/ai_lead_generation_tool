import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { groq } from "@/lib/groq";

type MessageType = "Connection Request" | "Follow-up Message" | "Cold Outreach";

const CHAR_LIMITS: Record<MessageType, number> = {
  "Connection Request": 300,
  "Follow-up Message": 500,
  "Cold Outreach":     500,
};

const VALID_TYPES = new Set<MessageType>(
  Object.keys(CHAR_LIMITS) as MessageType[]
);

function buildPrompt(
  lead: { name: string; company: string | null; title: string | null },
  messageType: MessageType
): string {
  const name    = lead.name;
  const company = lead.company ?? "their company";
  const title   = lead.title   ?? "their role";
  const limit   = CHAR_LIMITS[messageType];

  switch (messageType) {
    case "Connection Request":
      return `Write a LinkedIn connection request message for ${name}, who is a ${title} at ${company}.

Rules:
- Hard limit: ${limit} characters total — count carefully
- Professional, warm tone
- Mention their specific role and company naturally in 1 sentence
- Close with a concise reason to connect
- Start directly — no "Hi [Name]", no "I came across your profile"
- No placeholders like [Your Name] or [Your Company]

Return ONLY the message text.`;

    case "Follow-up Message":
      return `Write a LinkedIn follow-up message for ${name}, who is a ${title} at ${company}.

Rules:
- Hard limit: ${limit} characters total — count carefully
- Reference something specific and plausible about their work or company
- Offer one concrete, specific value proposition
- Conversational but professional
- Start directly — no "Hi [Name]" opener
- No placeholders

Return ONLY the message text.`;

    case "Cold Outreach":
      return `Write a LinkedIn cold outreach message for ${name}, who is a ${title} at ${company}.

Rules:
- Hard limit: ${limit} characters total — count carefully
- Open with a personalized line referencing their role or company
- One clear, specific value proposition
- Soft CTA — suggest a brief conversation, not a hard sell
- Start directly — no "Hi [Name]" opener
- No placeholders

Return ONLY the message text.`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { leadId?: string; messageType?: string };
    const { leadId, messageType } = body;

    if (!leadId || !messageType) {
      return NextResponse.json(
        { error: "leadId and messageType are required" },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.has(messageType as MessageType)) {
      return NextResponse.json(
        { error: "Invalid messageType" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, name, company, title, linkedin_url")
      .eq("id", leadId)
      .eq("user_id", user.id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const type = messageType as MessageType;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: buildPrompt(lead, type) }],
      temperature: 0.7,
      max_tokens: 300,
    });

    let message = completion.choices[0]?.message?.content?.trim() ?? "";

    // Hard-enforce the char limit as a safety net
    const limit = CHAR_LIMITS[type];
    if (message.length > limit) {
      message = message.slice(0, limit).trimEnd();
    }

    return NextResponse.json({
      message,
      characterCount: message.length,
      messageType: type,
    });
  } catch (err) {
    console.error("[linkedin/generate]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}

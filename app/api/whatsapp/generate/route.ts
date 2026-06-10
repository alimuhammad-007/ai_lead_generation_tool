import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { groq } from "@/lib/groq";

type MessageType = "Introduction" | "Follow-up" | "Service Offer";

const CHAR_LIMITS: Record<MessageType, number> = {
  "Introduction":  500,
  "Follow-up":     300,
  "Service Offer": 500,
};

const VALID_TYPES = new Set<MessageType>(Object.keys(CHAR_LIMITS) as MessageType[]);

// Normalise phone → digits only, prepend "1" if 10-digit (US assumption)
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return "1" + digits;
  return digits;
}

function buildWaLink(phone: string, message: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

function buildPrompt(
  lead: { name: string; company: string | null; title: string | null },
  messageType: MessageType
): string {
  const name    = lead.name;
  const company = lead.company ?? "their company";
  const title   = lead.title   ?? "their role";
  const limit   = CHAR_LIMITS[messageType];

  switch (messageType) {
    case "Introduction":
      return `Write a WhatsApp introduction message for ${name}, who is a ${title} at ${company}.

You are reaching out on behalf of an AI automation agency.

Rules:
- Hard limit: ${limit} characters — count carefully
- Casual, friendly, WhatsApp tone
- Use 1–2 emojis naturally (not forced)
- Mention their role/company in a natural way
- Briefly introduce AI automation services and the value they bring
- Short paragraphs (1–2 sentences each)
- End with a soft, low-pressure question
- No formal openers like "Dear" or "I hope this message finds you well"
- No placeholders like [Your Name]

Return ONLY the message text.`;

    case "Follow-up":
      return `Write a short WhatsApp follow-up message for ${name}, who is a ${title} at ${company}.

This is a gentle reminder after a previous outreach attempt.

Rules:
- Hard limit: ${limit} characters — count carefully
- Warm and brief — no pressure
- Reference the previous contact naturally (e.g. "just following up on my last message")
- Use 1 emoji at most
- End with an easy yes/no or open question
- No placeholders

Return ONLY the message text.`;

    case "Service Offer":
      return `Write a WhatsApp service offer message for ${name}, who is a ${title} at ${company}.

You are offering AI automation services tailored to their business.

Rules:
- Hard limit: ${limit} characters — count carefully
- Specific value proposition relevant to a ${title} at a company like ${company}
- Use 1–2 emojis naturally
- Short paragraphs, conversational tone
- One clear, low-friction CTA (e.g. "Would you be open to a quick 15-min call?")
- No generic filler like "I wanted to reach out"
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
      return NextResponse.json({ error: "Invalid messageType" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, name, company, title, phone")
      .eq("id", leadId)
      .eq("user_id", user.id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.phone) {
      return NextResponse.json({ error: "Lead has no phone number" }, { status: 422 });
    }

    const type = messageType as MessageType;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: buildPrompt(lead, type) }],
      temperature: 0.75,
      max_tokens: 300,
    });

    let message = completion.choices[0]?.message?.content?.trim() ?? "";

    const limit = CHAR_LIMITS[type];
    if (message.length > limit) {
      message = message.slice(0, limit).trimEnd();
    }

    return NextResponse.json({
      message,
      characterCount: message.length,
      messageType: type,
      waLink: buildWaLink(lead.phone, message),
    });
  } catch (err) {
    console.error("[whatsapp/generate]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}

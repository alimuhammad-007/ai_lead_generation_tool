import { groq } from "@/lib/groq";

export type EmailTone  = "professional" | "friendly" | "direct";
export type EmailAngle = "introduction" | "value_proposition" | "social_proof" | "breakup";

export type GeneratedEmail = { subject: string; body: string };

export type EmailGenInput = {
  name:         string;
  company:      string;
  title:        string;
  sequenceDay?: number;
  tone?:        EmailTone;
  angle?:       EmailAngle;
};

const TONE_DESC: Record<EmailTone, string> = {
  professional: "formal and professional, suitable for enterprise outreach",
  friendly:     "warm and conversational, like reaching out to a peer",
  direct:       "concise and value-focused, respecting the recipient's time",
};

const ANGLE_NOTE: Record<EmailAngle, string> = {
  introduction:
    "This is the FIRST email. Introduce yourself briefly, show genuine understanding of their world, and end with a soft low-pressure ask. Never say 'I hope this email finds you well'.",
  value_proposition:
    "This is a FOLLOW-UP email. Lead with a specific value proposition or ROI insight directly relevant to their role. Acknowledge you haven't heard back — one sentence max. Keep it shorter than the first email.",
  social_proof:
    "This is a LATER follow-up. Include one concrete case study or social proof example relevant to their industry (e.g., 'We helped a similar company achieve X in Y weeks'). One example only, then a soft CTA.",
  breakup:
    "This is the FINAL email. Keep it under 4 sentences. Acknowledge they've been busy. Make it genuinely easy to say no — give them an out. Leave the door open warmly but don't oversell.",
};

function buildPrompt(input: EmailGenInput): string {
  const tone  = input.tone ?? "professional";
  const angle = input.angle;
  const day   = input.sequenceDay ?? 1;

  let sequenceNote: string;
  if (angle) {
    sequenceNote = `\n\n${ANGLE_NOTE[angle]}`;
  } else if (day === 3) {
    sequenceNote =
      "\n\nThis is follow-up #2 (day 3). Briefly acknowledge no response, add a new value angle, keep it shorter than email #1.";
  } else if (day === 7) {
    sequenceNote =
      "\n\nThis is the final follow-up (day 7). Be brief, acknowledge it's your last note, make it easy to say no, single CTA.";
  } else {
    sequenceNote = "";
  }

  return `You are an expert B2B sales copywriter. Write a personalized cold outreach email.

Lead:
  Name:    ${input.name}
  Title:   ${input.title}
  Company: ${input.company}

Tone: ${TONE_DESC[tone]}${sequenceNote}

Rules:
- Subject: personalized, under 60 characters, no spam trigger words (free, guaranteed, urgent)
- Body: 3–5 short paragraphs, plain text only, no markdown, no HTML
- Open with something specific to their title/company — never "I hope this email finds you well"
- One clear soft CTA at the end (e.g., "Worth a 15-minute call this week?")
- Demonstrate value for someone in their specific role

Return ONLY this JSON — no code fences, no extra text:
{
  "subject": "<subject line>",
  "body": "<email body, use \\n for line breaks, \\n\\n for paragraph breaks>"
}`;
}

export async function generateEmail(input: EmailGenInput): Promise<GeneratedEmail> {
  let raw = "{}";
  try {
    const completion = await groq.chat.completions.create({
      model:           "llama-3.3-70b-versatile",
      messages:        [{ role: "user", content: buildPrompt(input) }],
      temperature:     0.7,
      max_tokens:      1024,
      response_format: { type: "json_object" },
    });
    raw = completion.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    console.error("[emailGenerator] Groq API error:", err);
    throw new Error("Failed to generate email: Groq API unavailable");
  }

  let parsed: { subject?: string; body?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[emailGenerator] JSON parse failed:", raw);
    throw new Error("Failed to parse generated email response");
  }

  if (!parsed.subject?.trim() || !parsed.body?.trim()) {
    throw new Error("Generated email is missing subject or body");
  }

  return { subject: parsed.subject.trim(), body: parsed.body.trim() };
}

export function bodyToHtml(body: string, trackingPixelUrl: string): string {
  const paragraphs = body
    .split("\n\n")
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;max-width:600px;">
${paragraphs}
</div>
<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;" />`;
}

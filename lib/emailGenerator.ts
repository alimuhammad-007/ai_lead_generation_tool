import { groq } from "@/lib/groq";

export type EmailTone = "professional" | "friendly" | "direct";

export type GeneratedEmail = {
  subject: string;
  body: string;
};

export type EmailGenInput = {
  name: string;
  company: string;
  title: string;
  sequenceDay?: 1 | 3 | 7;
  tone?: EmailTone;
};

const TONE_DESC: Record<EmailTone, string> = {
  professional: "formal and professional, suitable for enterprise outreach",
  friendly: "warm and conversational, like reaching out to a peer",
  direct: "concise and value-focused, respecting the recipient's time",
};

function buildPrompt(input: EmailGenInput): string {
  const tone = input.tone ?? "professional";
  const day = input.sequenceDay ?? 1;

  let sequenceNote = "";
  if (day === 3) {
    sequenceNote =
      "\nThis is follow-up email #2 sent 2 days after the first. Briefly acknowledge you haven't heard back, offer a new value angle, and keep it shorter than the original.";
  } else if (day === 7) {
    sequenceNote =
      "\nThis is the final follow-up (day 7). The lead has not responded. Be brief, acknowledge it's your last note, make it easy to say no, and give a simple single CTA.";
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
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: buildPrompt(input) }],
      temperature: 0.7,
      max_tokens: 1024,
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

  return {
    subject: parsed.subject.trim(),
    body: parsed.body.trim(),
  };
}

/** Convert plain-text body to minimal HTML paragraphs. */
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

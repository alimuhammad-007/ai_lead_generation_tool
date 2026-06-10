"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lead, LeadResearch, LeadStatus } from "@/types/database";

interface Props {
  leads: Lead[];
}

// ── Style maps ────────────────────────────────────────────────────────────────

const STATUS_PILL_CLS: Record<LeadStatus, string> = {
  hot:      "bg-rose-50  text-rose-700  ring-rose-200",
  warm:     "bg-amber-50 text-amber-700 ring-amber-200",
  cold:     "bg-blue-50  text-blue-700  ring-blue-200",
  unscored: "bg-slate-50 text-slate-500 ring-slate-200",
};

const STATUS_DOT: Record<LeadStatus, string> = {
  hot:      "bg-rose-500",
  warm:     "bg-amber-400",
  cold:     "bg-blue-400",
  unscored: "bg-slate-300",
};

const AVATAR_CLS: Record<LeadStatus, string> = {
  hot:      "bg-rose-100  text-rose-700",
  warm:     "bg-amber-100 text-amber-700",
  cold:     "bg-blue-100  text-blue-700",
  unscored: "bg-slate-100 text-slate-500",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ColHeader({ children, center, width }: { children: React.ReactNode; center?: boolean; width?: string }) {
  return (
    <th
      style={width ? { width } : undefined}
      className={`px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 ${center ? "text-center" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function StatusPill({ status, score }: { status: LeadStatus; score: number }) {
  return (
    <span className={`inline-flex cursor-default items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ${STATUS_PILL_CLS[status]}`}>
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${STATUS_DOT[status]}`} />
      {status}
      {status !== "unscored" && (
        <span className="font-bold tabular-nums">{score}</span>
      )}
    </span>
  );
}

function ResearchSection({
  icon,
  label,
  color,
  children,
}: {
  icon: string;
  label: string;
  color: "slate" | "amber" | "rose" | "emerald";
  children: React.ReactNode;
}) {
  const border = { slate: "border-slate-100", amber: "border-amber-100", rose: "border-rose-100", emerald: "border-emerald-100" }[color];
  const bg     = { slate: "bg-slate-50",      amber: "bg-amber-50",      rose: "bg-rose-50",      emerald: "bg-emerald-50"  }[color];
  const text   = { slate: "text-slate-500",   amber: "text-amber-700",   rose: "text-rose-600",   emerald: "text-emerald-700" }[color];
  return (
    <div className={`rounded-xl border ${border} ${bg} px-4 py-3`}>
      <p className={`mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${text}`}>
        <span>{icon}</span>{label}
      </p>
      {children}
    </div>
  );
}

function InitialsAvatar({ name, status }: { name: string; status: LeadStatus }) {
  const ini = name.split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("");
  return (
    <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${AVATAR_CLS[status]}`}>
      {ini}
    </span>
  );
}

function Spinner({ sm }: { sm?: boolean }) {
  const sz = sm ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <svg className={`${sz} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function LinkedInBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const cls = size === "md"
    ? "flex h-5 w-5 items-center justify-center rounded text-[10px] font-black text-white flex-shrink-0"
    : "flex h-3.5 w-3.5 items-center justify-center rounded text-[8px] font-black text-white flex-shrink-0";
  return <span className={cls} style={{ backgroundColor: "#0A66C2" }}>in</span>;
}

function WhatsAppIcon({ cls = "h-3.5 w-3.5" }: { cls?: string }) {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function SearchIcon({ cls = "h-3.5 w-3.5" }: { cls?: string }) {
  return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

// ── Minimal markdown → HTML (for proposal display & print) ───────────────────

function simpleMarkdown(md: string): string {
  const lines = md.split("\n");
  const html  = lines.map((line) => {
    if (/^### /.test(line)) return `<h3 style="margin:16px 0 6px;font-size:14px;font-weight:700;color:#1e293b;">${esc(line.slice(4))}</h3>`;
    if (/^## /.test(line))  return `<h2 style="margin:20px 0 8px;font-size:16px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">${esc(line.slice(3))}</h2>`;
    if (/^# /.test(line))   return `<h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#0f172a;">${esc(line.slice(2))}</h1>`;
    if (/^---/.test(line))  return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;"/>`;
    if (/^\s*[-*] /.test(line)) return `<li style="margin:4px 0;color:#334155;">${esc(line.replace(/^\s*[-*] /, ""))}</li>`;
    if (/^\d+\. /.test(line))   return `<li style="margin:4px 0;color:#334155;">${esc(line.replace(/^\d+\. /, ""))}</li>`;
    if (line.trim() === "")     return `<br/>`;
    return `<p style="margin:6px 0;color:#334155;line-height:1.6;">${esc(line)}</p>`;
  });
  return html
    .join("")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    .replace(/`(.+?)`/g,       `<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:12px;">$1</code>`);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Sequence preview data ─────────────────────────────────────────────────────

type SequenceType = "standard" | "aggressive" | "gentle";

const SEQ_LABELS: Record<SequenceType, string> = {
  standard:   "Standard (Days 1·3·7·14)",
  aggressive: "Aggressive (Days 1·2·4·7)",
  gentle:     "Gentle (Days 1·5·14·30)",
};

const SEQ_PREVIEW: Record<SequenceType, { day: number; offset: number; label: string }[]> = {
  standard: [
    { day:  1, offset:  0, label: "Introduction"      },
    { day:  3, offset:  2, label: "Value Proposition" },
    { day:  7, offset:  6, label: "Social Proof"      },
    { day: 14, offset: 13, label: "Breakup Email"     },
  ],
  aggressive: [
    { day:  1, offset:  0, label: "Introduction"      },
    { day:  2, offset:  1, label: "Value Proposition" },
    { day:  4, offset:  3, label: "Social Proof"      },
    { day:  7, offset:  6, label: "Breakup Email"     },
  ],
  gentle: [
    { day:  1, offset:  0,  label: "Introduction"      },
    { day:  5, offset:  4,  label: "Value Proposition" },
    { day: 14, offset: 13,  label: "Social Proof"      },
    { day: 30, offset: 29,  label: "Breakup Email"     },
  ],
};

// ── Icon-button wrapper ───────────────────────────────────────────────────────

function ActionBtn({
  onClick,
  href,
  title,
  children,
  color,
}: {
  onClick?: () => void;
  href?: string;
  title: string;
  children: React.ReactNode;
  color?: "indigo" | "linkedin" | "whatsapp" | "blue";
}) {
  const colorCls = {
    indigo:   "hover:border-indigo-300 hover:bg-indigo-50   hover:text-indigo-600",
    linkedin: "hover:border-[#0A66C2]/40 hover:bg-[#0A66C2]/5",
    whatsapp: "hover:border-[#25D366]/40 hover:bg-[#25D366]/5",
    blue:     "hover:border-blue-300    hover:bg-blue-50    hover:text-blue-600",
  }[color ?? "indigo"];

  const base = `inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors ${colorCls}`;

  if (href) {
    return (
      <a href={href} title={title} className={base}>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} title={title} className={base}>
      {children}
    </button>
  );
}

// ── WhatsApp types ────────────────────────────────────────────────────────────

type WhatsAppMessageType = "Introduction" | "Follow-up" | "Service Offer";

const WHATSAPP_TYPES: WhatsAppMessageType[] = ["Introduction", "Follow-up", "Service Offer"];

const WHATSAPP_CHAR_LIMITS: Record<WhatsAppMessageType, number> = {
  "Introduction":  500,
  "Follow-up":     300,
  "Service Offer": 500,
};

// ── LinkedIn types ────────────────────────────────────────────────────────────

type LinkedInMessageType = "Connection Request" | "Follow-up Message" | "Cold Outreach";

const LINKEDIN_TYPES: LinkedInMessageType[] = ["Connection Request", "Follow-up Message", "Cold Outreach"];

const LINKEDIN_CHAR_LIMITS: Record<LinkedInMessageType, number> = {
  "Connection Request": 300,
  "Follow-up Message":  500,
  "Cold Outreach":      500,
};

// ── Type guards ───────────────────────────────────────────────────────────────

function hasRealEmail(lead: Lead): lead is Lead & { email: string } {
  return !!(lead.email && lead.email !== "unknown@unknown.com");
}

function hasLinkedIn(lead: Lead): lead is Lead & { linkedin_url: string } {
  return !!lead.linkedin_url;
}

function hasPhone(lead: Lead): lead is Lead & { phone: string } {
  return !!lead.phone;
}

// ── Main component ────────────────────────────────────────────────────────────

export function LeadsTable({ leads }: Props) {
  const router = useRouter();

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Single-email modal
  const [modalLead, setModalLead]       = useState<Lead | null>(null);
  const [generating, setGenerating]     = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody]       = useState("");
  const [sending, setSending]           = useState(false);
  const [modalError, setModalError]     = useState<string | null>(null);
  const [modalSent, setModalSent]       = useState(false);

  // Bulk send
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult]   = useState<{ sent: number; failed: number } | null>(null);

  // WhatsApp modal
  const [waLead, setWaLead]             = useState<Lead | null>(null);
  const [waType, setWaType]             = useState<WhatsAppMessageType>("Introduction");
  const [waMessage, setWaMessage]       = useState("");
  const [waLink, setWaLink]             = useState("");
  const [waGenerating, setWaGenerating] = useState(false);
  const [waError, setWaError]           = useState<string | null>(null);
  const [waCopied, setWaCopied]         = useState(false);

  // LinkedIn modal
  const [linkedInLead, setLinkedInLead]               = useState<Lead | null>(null);
  const [linkedInType, setLinkedInType]               = useState<LinkedInMessageType>("Connection Request");
  const [linkedInMessage, setLinkedInMessage]         = useState("");
  const [linkedInGenerating, setLinkedInGenerating]   = useState(false);
  const [linkedInError, setLinkedInError]             = useState<string | null>(null);
  const [linkedInCopied, setLinkedInCopied]           = useState(false);

  // Sequence modal
  const [seqLead, setSeqLead]         = useState<Lead | null>(null);
  const [seqType, setSeqType]         = useState<SequenceType>("standard");
  const [seqStarting, setSeqStarting] = useState(false);
  const [seqError, setSeqError]       = useState<string | null>(null);
  const [seqDone, setSeqDone]         = useState(false);

  // Research modal
  const [researchLead, setResearchLead]     = useState<Lead | null>(null);
  const [researching, setResearching]       = useState(false);
  const [researchData, setResearchData]     = useState<LeadResearch | null>(null);
  const [researchError, setResearchError]   = useState<string | null>(null);

  // Proposal modal
  const [proposalLead, setProposalLead]         = useState<Lead | null>(null);
  const [proposalText, setProposalText]         = useState("");
  const [proposalGenerating, setProposalGenerating] = useState(false);
  const [proposalError, setProposalError]       = useState<string | null>(null);
  const [proposalCopied, setProposalCopied]     = useState(false);

  // ── Selection helpers ──────────────────────────────────────────────────────

  const emailableLeads       = leads.filter(hasRealEmail);
  const allEmailableSelected = emailableLeads.length > 0 && emailableLeads.every((l) => selected.has(l.id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    allEmailableSelected
      ? setSelected(new Set())
      : setSelected(new Set(emailableLeads.map((l) => l.id)));
  }

  function clearSelection() {
    setSelected(new Set());
    setBulkResult(null);
  }

  // ── Single-email flow ──────────────────────────────────────────────────────

  async function openEmailModal(lead: Lead) {
    setModalLead(lead);
    setGenerating(true);
    setModalError(null);
    setModalSent(false);
    setEmailSubject("");
    setEmailBody("");
    try {
      const res  = await fetch("/api/outreach/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leadId: lead.id, generate_only: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setEmailSubject(data.subject ?? "");
      setEmailBody(data.body ?? "");
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Failed to generate email");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSendSingle() {
    if (!modalLead) return;
    setSending(true);
    setModalError(null);
    try {
      const res  = await fetch("/api/outreach/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leadId: modalLead.id, generate_only: false, subject: emailSubject, body: emailBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setModalSent(true);
      setTimeout(() => { setModalLead(null); router.refresh(); }, 1800);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  }

  // ── WhatsApp modal ─────────────────────────────────────────────────────────

  function openWaModal(lead: Lead) {
    setWaLead(lead);
    setWaType("Introduction");
    setWaMessage("");
    setWaLink("");
    setWaError(null);
    setWaCopied(false);
  }

  async function generateWaMessage() {
    if (!waLead) return;
    setWaGenerating(true);
    setWaError(null);
    setWaCopied(false);
    try {
      const res  = await fetch("/api/whatsapp/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leadId: waLead.id, messageType: waType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setWaMessage(data.message ?? "");
      setWaLink(data.waLink ?? "");
    } catch (e) {
      setWaError(e instanceof Error ? e.message : "Failed to generate message");
    } finally {
      setWaGenerating(false);
    }
  }

  async function copyWaMessage() {
    if (!waMessage) return;
    await navigator.clipboard.writeText(waMessage);
    setWaCopied(true);
    setTimeout(() => setWaCopied(false), 2000);
  }

  // ── LinkedIn modal ─────────────────────────────────────────────────────────

  function openLinkedInModal(lead: Lead) {
    setLinkedInLead(lead);
    setLinkedInType("Connection Request");
    setLinkedInMessage("");
    setLinkedInError(null);
    setLinkedInCopied(false);
  }

  async function generateLinkedInMessage() {
    if (!linkedInLead) return;
    setLinkedInGenerating(true);
    setLinkedInError(null);
    setLinkedInCopied(false);
    try {
      const res  = await fetch("/api/linkedin/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leadId: linkedInLead.id, messageType: linkedInType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setLinkedInMessage(data.message ?? "");
    } catch (e) {
      setLinkedInError(e instanceof Error ? e.message : "Failed to generate message");
    } finally {
      setLinkedInGenerating(false);
    }
  }

  async function copyLinkedInMessage() {
    if (!linkedInMessage) return;
    await navigator.clipboard.writeText(linkedInMessage);
    setLinkedInCopied(true);
    setTimeout(() => setLinkedInCopied(false), 2000);
  }

  // ── Sequence modal ─────────────────────────────────────────────────────────

  function openSeqModal(lead: Lead) {
    setSeqLead(lead);
    setSeqType("standard");
    setSeqStarting(false);
    setSeqError(null);
    setSeqDone(false);
  }

  async function startSequence() {
    if (!seqLead) return;
    setSeqStarting(true);
    setSeqError(null);
    try {
      const res  = await fetch("/api/outreach/sequence", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leadId: seqLead.id, sequenceType: seqType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start sequence");
      setSeqDone(true);
      setTimeout(() => { setSeqLead(null); router.refresh(); }, 2000);
    } catch (e) {
      setSeqError(e instanceof Error ? e.message : "Failed to start sequence");
    } finally {
      setSeqStarting(false);
    }
  }

  // ── Research modal ─────────────────────────────────────────────────────────

  function openResearchModal(lead: Lead) {
    setResearchLead(lead);
    setResearching(false);
    setResearchData(lead.research ?? null);
    setResearchError(null);
  }

  async function runResearch() {
    if (!researchLead) return;
    setResearching(true);
    setResearchError(null);
    try {
      const res  = await fetch("/api/research", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leadId: researchLead.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Research failed");
      setResearchData(data.research as LeadResearch);
      router.refresh();
    } catch (e) {
      setResearchError(e instanceof Error ? e.message : "Research failed");
    } finally {
      setResearching(false);
    }
  }

  function useInEmail(lead: Lead, research: LeadResearch) {
    const firstName = lead.name.split(" ")[0];
    const tp        = research.talking_points;
    const angle     = research.best_outreach_angle;
    const subject   = angle.length > 60 ? angle.slice(0, 57) + "…" : angle;
    const body = [
      `Hi ${firstName},`,
      "",
      tp[0] ?? `I came across ${lead.company ?? "your company"} and wanted to reach out.`,
      "",
      tp[1] ?? `Given your role as ${lead.title ?? "a leader in your space"}, I believe we could create real value together.`,
      "",
      tp[2] ?? "I'd love to share how we've helped similar companies in your industry.",
      "",
      "Would you be open to a quick 15-minute call this week?",
      "",
      "Best,",
    ].join("\n");

    setResearchLead(null);
    setModalLead(lead);
    setEmailSubject(subject);
    setEmailBody(body);
    setGenerating(false);
    setModalSent(false);
    setModalError(null);
  }

  // ── Proposal modal ─────────────────────────────────────────────────────────

  function openProposalModal(lead: Lead) {
    setProposalLead(lead);
    setProposalText("");
    setProposalGenerating(false);
    setProposalError(null);
    setProposalCopied(false);
  }

  async function generateProposal() {
    if (!proposalLead) return;
    setProposalGenerating(true);
    setProposalError(null);
    setProposalCopied(false);
    try {
      const res  = await fetch("/api/proposal", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leadId: proposalLead.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setProposalText(data.proposal ?? "");
    } catch (e) {
      setProposalError(e instanceof Error ? e.message : "Proposal generation failed");
    } finally {
      setProposalGenerating(false);
    }
  }

  async function copyProposal() {
    if (!proposalText) return;
    await navigator.clipboard.writeText(proposalText);
    setProposalCopied(true);
    setTimeout(() => setProposalCopied(false), 2000);
  }

  function downloadProposalAsPdf() {
    if (!proposalText || !proposalLead) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Proposal — ${proposalLead.name}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 760px; margin: 48px auto; color: #1e293b; font-size: 14px; line-height: 1.7; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  ${simpleMarkdown(proposalText)}
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`);
    win.document.close();
  }

  // ── Bulk send ──────────────────────────────────────────────────────────────

  async function handleBulkSend() {
    setBulkSending(true);
    setBulkResult(null);
    try {
      const res  = await fetch("/api/outreach/bulk", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leadIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk send failed");
      setBulkResult({ sent: data.sent, failed: data.failed });
      setSelected(new Set());
      router.refresh();
    } catch {
      setBulkResult({ sent: 0, failed: selected.size });
      setSelected(new Set());
    } finally {
      setBulkSending(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5">
          <span className="flex-1 text-sm font-medium text-indigo-700">
            {selected.size} lead{selected.size !== 1 ? "s" : ""} selected
          </span>
          {bulkResult && (
            <span className={`text-xs font-semibold ${bulkResult.failed > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {bulkResult.sent} sent{bulkResult.failed > 0 ? `, ${bulkResult.failed} failed` : " ✓"}
            </span>
          )}
          <button
            onClick={handleBulkSend}
            disabled={bulkSending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkSending ? (
              <><Spinner sm />Sending {selected.size}…</>
            ) : (
              <><MailIcon />Generate &amp; Send Emails</>
            )}
          </button>
          <button
            onClick={clearSelection}
            disabled={bulkSending}
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {/*
            table-fixed + explicit column widths keep the table within viewport.
            Columns: cb(36) | Name(170) | Company(120) | Title(120) | Email(160) | Phone(120) | Status(110) | Action(120)
            Total ≈ 956px — fits standard 1024px+ content area.
          */}
          <table className="w-full table-fixed divide-y divide-slate-50 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th style={{ width: 36 }} className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allEmailableSelected}
                    onChange={toggleSelectAll}
                    title="Select all emailable leads"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                </th>
                <ColHeader width="170px">Name</ColHeader>
                <ColHeader width="120px">Company</ColHeader>
                <ColHeader width="120px">Title</ColHeader>
                <ColHeader width="160px">Email</ColHeader>
                <ColHeader width="120px">Phone</ColHeader>
                <ColHeader width="110px" center>Status</ColHeader>
                <ColHeader center>Action</ColHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leads.map((lead) => {
                const canEmail  = hasRealEmail(lead);
                const isChecked = selected.has(lead.id);
                return (
                  <tr
                    key={lead.id}
                    className={`transition-colors hover:bg-slate-50/60 ${isChecked ? "bg-indigo-50/30" : ""}`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2.5">
                      {canEmail ? (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRow(lead.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                        />
                      ) : (
                        <span className="block h-4 w-4" />
                      )}
                    </td>

                    {/* Name */}
                    <td className="px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <InitialsAvatar name={lead.name} status={lead.status} />
                        <span className="truncate font-medium text-slate-900">{lead.name}</span>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-3 py-2.5">
                      <span className="block truncate text-slate-600">{lead.company ?? "—"}</span>
                    </td>

                    {/* Title */}
                    <td className="px-3 py-2.5">
                      <span className="block truncate text-slate-500">{lead.title ?? "—"}</span>
                    </td>

                    {/* Email */}
                    <td className="px-3 py-2.5">
                      <span className="block truncate font-mono text-xs text-slate-500">{lead.email ?? "—"}</span>
                    </td>

                    {/* Phone */}
                    <td className="px-3 py-2.5">
                      {lead.phone ? (
                        <div className="flex min-w-0 items-center gap-1.5">
                          <PhoneIcon />
                          <span className="truncate font-mono text-xs text-slate-600">{lead.phone}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>

                    {/* Status + score */}
                    <td className="px-3 py-2.5 text-center">
                      <StatusPill status={lead.status} score={lead.score} />
                    </td>

                    {/* Action — icon-only buttons with tooltips */}
                    <td className="px-3 py-2.5 text-center">
                      <div className="inline-flex items-center justify-center gap-1">
                        {canEmail && (
                          <ActionBtn onClick={() => openEmailModal(lead)} title="Send Email" color="indigo">
                            <MailIcon />
                          </ActionBtn>
                        )}
                        {canEmail && (
                          <ActionBtn onClick={() => openSeqModal(lead)} title="Start Follow-up Sequence" color="indigo">
                            <CalendarIcon />
                          </ActionBtn>
                        )}
                        <ActionBtn
                          onClick={() => openProposalModal(lead)}
                          title="Generate proposal"
                          color="indigo"
                        >
                          <DocumentIcon />
                        </ActionBtn>
                        <ActionBtn
                          onClick={() => openResearchModal(lead)}
                          title={lead.research ? "View / Re-research company" : "Research company"}
                          color="indigo"
                        >
                          <span className="relative">
                            <SearchIcon />
                            {lead.research && (
                              <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            )}
                          </span>
                        </ActionBtn>
                        {hasLinkedIn(lead) && (
                          <ActionBtn onClick={() => openLinkedInModal(lead)} title="Generate LinkedIn message" color="linkedin">
                            <LinkedInBadge />
                          </ActionBtn>
                        )}
                        {hasPhone(lead) && (
                          <>
                            <ActionBtn onClick={() => openWaModal(lead)} title="Generate WhatsApp message" color="whatsapp">
                              <WhatsAppIcon cls="h-3.5 w-3.5 text-[#25D366]" />
                            </ActionBtn>
                            <ActionBtn href={`tel:${lead.phone}`} title={`Call ${lead.phone}`} color="blue">
                              <PhoneIcon />
                            </ActionBtn>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── WhatsApp modal ── */}
      {waLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !waGenerating && setWaLead(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: "#25D366" }}>
                  <WhatsAppIcon cls="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">WhatsApp — {waLead.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {[waLead.title, waLead.company].filter(Boolean).join(" · ")}
                    {waLead.phone && <span className="ml-1.5 font-mono">{waLead.phone}</span>}
                  </p>
                </div>
              </div>
              <button onClick={() => setWaLead(null)} disabled={waGenerating} className="rounded-lg p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-40">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Message Type</label>
                <select
                  value={waType}
                  onChange={(e) => { setWaType(e.target.value as WhatsAppMessageType); setWaMessage(""); setWaLink(""); setWaError(null); }}
                  disabled={waGenerating}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/10 disabled:opacity-60"
                >
                  {WHATSAPP_TYPES.map((t) => (
                    <option key={t} value={t}>{t} (max {WHATSAPP_CHAR_LIMITS[t]} chars)</option>
                  ))}
                </select>
              </div>

              {waError && <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{waError}</div>}
              {waGenerating && (
                <div className="flex items-center justify-center gap-2.5 py-10 text-sm text-slate-500">
                  <Spinner />Generating personalized WhatsApp message…
                </div>
              )}
              {!waGenerating && waMessage && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message Preview</label>
                    <span className={`text-xs tabular-nums font-medium ${waMessage.length > WHATSAPP_CHAR_LIMITS[waType] ? "text-rose-600" : waMessage.length > WHATSAPP_CHAR_LIMITS[waType] * 0.9 ? "text-amber-600" : "text-slate-400"}`}>
                      {waMessage.length} / {WHATSAPP_CHAR_LIMITS[waType]}
                    </span>
                  </div>
                  <textarea value={waMessage} onChange={(e) => setWaMessage(e.target.value)} rows={6} className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/10" />
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full transition-all ${waMessage.length > WHATSAPP_CHAR_LIMITS[waType] ? "bg-rose-500" : waMessage.length > WHATSAPP_CHAR_LIMITS[waType] * 0.9 ? "bg-amber-400" : "bg-[#25D366]"}`} style={{ width: `${Math.min(100, (waMessage.length / WHATSAPP_CHAR_LIMITS[waType]) * 100)}%` }} />
                  </div>
                </div>
              )}
              {!waGenerating && !waMessage && !waError && (
                <p className="py-4 text-center text-xs text-slate-400">Select a message type and click &ldquo;Generate Message&rdquo; to get started.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
              <button onClick={() => setWaLead(null)} disabled={waGenerating} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40">Close</button>
              <div className="flex items-center gap-2">
                <button onClick={generateWaMessage} disabled={waGenerating} className="inline-flex items-center gap-2 rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 px-4 py-2 text-sm font-semibold text-[#128C7E] transition hover:bg-[#25D366]/10 disabled:cursor-not-allowed disabled:opacity-50">
                  {waGenerating ? (<><Spinner />Generating…</>) : (<><WhatsAppIcon cls="h-3.5 w-3.5 text-[#25D366]" />{waMessage ? "Regenerate" : "Generate Message"}</>)}
                </button>
                {waMessage && (
                  <>
                    <button onClick={copyWaMessage} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300">
                      {waCopied ? (
                        <><svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>
                      ) : (
                        <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>Copy</>
                      )}
                    </button>
                    <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition" style={{ backgroundColor: "#25D366" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#128C7E")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#25D366")}>
                      <WhatsAppIcon cls="h-3.5 w-3.5" />Open WhatsApp
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LinkedIn modal ── */}
      {linkedInLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !linkedInGenerating && setLinkedInLead(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <LinkedInBadge size="md" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">LinkedIn — {linkedInLead.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-400">{[linkedInLead.title, linkedInLead.company].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <button onClick={() => setLinkedInLead(null)} disabled={linkedInGenerating} className="rounded-lg p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-40">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Message Type</label>
                <select
                  value={linkedInType}
                  onChange={(e) => { setLinkedInType(e.target.value as LinkedInMessageType); setLinkedInMessage(""); setLinkedInError(null); }}
                  disabled={linkedInGenerating}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/10 disabled:opacity-60"
                >
                  {LINKEDIN_TYPES.map((t) => (
                    <option key={t} value={t}>{t} (max {LINKEDIN_CHAR_LIMITS[t]} chars)</option>
                  ))}
                </select>
              </div>

              {linkedInError && <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{linkedInError}</div>}
              {linkedInGenerating && (
                <div className="flex items-center justify-center gap-2.5 py-10 text-sm text-slate-500">
                  <Spinner />Generating personalized LinkedIn message…
                </div>
              )}
              {!linkedInGenerating && linkedInMessage && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message Preview</label>
                    <span className={`text-xs tabular-nums font-medium ${linkedInMessage.length > LINKEDIN_CHAR_LIMITS[linkedInType] ? "text-rose-600" : linkedInMessage.length > LINKEDIN_CHAR_LIMITS[linkedInType] * 0.9 ? "text-amber-600" : "text-slate-400"}`}>
                      {linkedInMessage.length} / {LINKEDIN_CHAR_LIMITS[linkedInType]}
                    </span>
                  </div>
                  <textarea value={linkedInMessage} onChange={(e) => setLinkedInMessage(e.target.value)} rows={6} className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/10" />
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full transition-all ${linkedInMessage.length > LINKEDIN_CHAR_LIMITS[linkedInType] ? "bg-rose-500" : linkedInMessage.length > LINKEDIN_CHAR_LIMITS[linkedInType] * 0.9 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (linkedInMessage.length / LINKEDIN_CHAR_LIMITS[linkedInType]) * 100)}%` }} />
                  </div>
                </div>
              )}
              {!linkedInGenerating && !linkedInMessage && !linkedInError && (
                <p className="py-4 text-center text-xs text-slate-400">Select a message type and click &ldquo;Generate Message&rdquo; to get started.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
              <button onClick={() => setLinkedInLead(null)} disabled={linkedInGenerating} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40">Close</button>
              <div className="flex items-center gap-2">
                <button onClick={generateLinkedInMessage} disabled={linkedInGenerating} className="inline-flex items-center gap-2 rounded-xl border border-[#0A66C2]/30 bg-[#0A66C2]/5 px-4 py-2 text-sm font-semibold text-[#0A66C2] transition hover:bg-[#0A66C2]/10 disabled:cursor-not-allowed disabled:opacity-50">
                  {linkedInGenerating ? (<><Spinner />Generating…</>) : (<><LinkedInBadge />{linkedInMessage ? "Regenerate" : "Generate Message"}</>)}
                </button>
                {linkedInMessage && (
                  <>
                    <button onClick={copyLinkedInMessage} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300">
                      {linkedInCopied ? (
                        <><svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>
                      ) : (
                        <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>Copy</>
                      )}
                    </button>
                    <a href={linkedInLead.linkedin_url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A66C2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#004182]">
                      <LinkedInBadge />Open LinkedIn
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Proposal modal ── */}
      {proposalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !proposalGenerating && setProposalLead(null)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <DocumentIcon />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Proposal Generator</h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {proposalLead.name}
                    {proposalLead.company && <span className="mx-1">·</span>}
                    {proposalLead.company}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProposalLead(null)}
                disabled={proposalGenerating}
                className="rounded-lg p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-40"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* Generating */}
              {proposalGenerating && (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                    <Spinner />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Generating proposal…</p>
                  <p className="text-xs text-slate-400">
                    Analyzing {proposalLead.company ?? "company"} research and crafting a personalized proposal
                  </p>
                </div>
              )}

              {/* Error */}
              {!proposalGenerating && proposalError && (
                <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {proposalError}
                </div>
              )}

              {/* Empty state */}
              {!proposalGenerating && !proposalText && !proposalError && (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <DocumentIcon />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">No proposal generated yet</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Click &ldquo;Generate Proposal&rdquo; to create a personalized proposal using AI
                      {proposalLead.research && " + company research"}.
                    </p>
                  </div>
                  {proposalLead.research && (
                    <div className="mt-1 flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Research available — proposal will be more personalized
                    </div>
                  )}
                </div>
              )}

              {/* Proposal content */}
              {!proposalGenerating && proposalText && (
                <div className="space-y-2">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Generated Proposal
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {proposalText.split(/\s+/).length} words
                    </span>
                  </div>
                  {/* Rendered preview */}
                  <div
                    className="rounded-xl border border-slate-100 bg-slate-50 p-5 text-sm"
                    dangerouslySetInnerHTML={{ __html: simpleMarkdown(proposalText) }}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setProposalLead(null)}
                disabled={proposalGenerating}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40"
              >
                Close
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={generateProposal}
                  disabled={proposalGenerating}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {proposalGenerating ? (
                    <><Spinner />Generating…</>
                  ) : (
                    <><DocumentIcon />{proposalText ? "Regenerate" : "Generate Proposal"}</>
                  )}
                </button>
                {proposalText && (
                  <>
                    <button
                      onClick={copyProposal}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                    >
                      {proposalCopied ? (
                        <><svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>
                      ) : (
                        <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>Copy</>
                      )}
                    </button>
                    <button
                      onClick={downloadProposalAsPdf}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download PDF
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Research modal ── */}
      {researchLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !researching && setResearchLead(null)}
          />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                  <SearchIcon cls="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Company Research</h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {researchLead.name}
                    {researchLead.company && <span className="mx-1">·</span>}
                    {researchLead.company}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResearchLead(null)}
                disabled={researching}
                className="rounded-lg p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-40"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* Loading state */}
              {researching && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-violet-50">
                    <Spinner />
                  </div>
                  <p className="text-sm font-medium">Researching {researchLead.company ?? "company"}…</p>
                  <p className="text-xs text-slate-400">Searching news, profiles, and business intelligence</p>
                </div>
              )}

              {/* Error state */}
              {!researching && researchError && (
                <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {researchError}
                </div>
              )}

              {/* Empty state */}
              {!researching && !researchData && !researchError && (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <SearchIcon cls="h-6 w-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">No research yet</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Click &ldquo;Research Lead&rdquo; to analyze {researchLead.company ?? "this company"} using AI + live search.
                    </p>
                  </div>
                </div>
              )}

              {/* Research results */}
              {!researching && researchData && (
                <div className="space-y-4">

                  {/* Timestamp */}
                  <p className="text-[11px] text-slate-400">
                    Researched{" "}
                    {new Date(researchData.researched_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>

                  {/* Best outreach angle — featured */}
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      Best Outreach Angle
                    </p>
                    <p className="text-sm font-semibold leading-snug text-indigo-800">
                      {researchData.best_outreach_angle || "—"}
                    </p>
                  </div>

                  {/* Company summary */}
                  <ResearchSection
                    icon="🏢"
                    label="Company Summary"
                    color="slate"
                  >
                    <p className="text-sm leading-relaxed text-slate-700">
                      {researchData.company_summary || "—"}
                    </p>
                  </ResearchSection>

                  {/* Recent news */}
                  <ResearchSection
                    icon="📰"
                    label="Recent News"
                    color="amber"
                  >
                    <p className="text-sm leading-relaxed text-slate-700">
                      {researchData.recent_news || "—"}
                    </p>
                  </ResearchSection>

                  {/* Pain points */}
                  <ResearchSection
                    icon="⚡"
                    label="Pain Points"
                    color="rose"
                  >
                    <p className="text-sm leading-relaxed text-slate-700">
                      {researchData.pain_points || "—"}
                    </p>
                  </ResearchSection>

                  {/* Talking points */}
                  <ResearchSection
                    icon="💬"
                    label="Talking Points"
                    color="emerald"
                  >
                    <ol className="space-y-2">
                      {researchData.talking_points.map((tp, i) => (
                        <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                          <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{tp}</span>
                        </li>
                      ))}
                    </ol>
                  </ResearchSection>

                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 items-center justify-between border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setResearchLead(null)}
                disabled={researching}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={runResearch}
                  disabled={researching}
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {researching ? (
                    <><Spinner />Researching…</>
                  ) : (
                    <><SearchIcon />{researchData ? "Re-Research" : "Research Lead"}</>
                  )}
                </button>
                {researchData && (
                  <button
                    onClick={() => useInEmail(researchLead, researchData)}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    <MailIcon />
                    Use in Email
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Sequence modal ── */}
      {seqLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !seqStarting && setSeqLead(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <CalendarIcon />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Follow-up Sequence</h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {seqLead.name} · {seqLead.company ?? seqLead.title ?? ""}
                  </p>
                </div>
              </div>
              <button onClick={() => setSeqLead(null)} disabled={seqStarting} className="rounded-lg p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-40">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {seqDone ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Sequence started! {SEQ_PREVIEW[seqType].length} emails scheduled.
                </div>
              ) : (
                <>
                  {/* Sequence type selector */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sequence Type</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["standard", "aggressive", "gentle"] as SequenceType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setSeqType(t)}
                          disabled={seqStarting}
                          className={[
                            "rounded-xl border px-2 py-2 text-xs font-semibold capitalize transition-colors",
                            seqType === t
                              ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600",
                          ].join(" ")}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">{SEQ_LABELS[seqType]}</p>
                  </div>

                  {/* Schedule preview */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule Preview</label>
                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            {["Day", "Email", "Date"].map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {SEQ_PREVIEW[seqType].map((step) => {
                            const d = new Date(Date.now() + step.offset * 86_400_000);
                            return (
                              <tr key={step.day}>
                                <td className="px-3 py-2">
                                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 ring-1 ring-indigo-200">
                                    Day {step.day}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-700">{step.label}</td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                                  {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {seqError && (
                    <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{seqError}</div>
                  )}

                  {seqStarting && (
                    <div className="flex items-center justify-center gap-2.5 py-4 text-sm text-slate-500">
                      <Spinner />Generating {SEQ_PREVIEW[seqType].length} emails with AI…
                    </div>
                  )}
                </>
              )}
            </div>

            {!seqDone && (
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
                <button onClick={() => setSeqLead(null)} disabled={seqStarting} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40">
                  Cancel
                </button>
                <button
                  onClick={startSequence}
                  disabled={seqStarting}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {seqStarting ? (
                    <><Spinner />Scheduling…</>
                  ) : (
                    <><CalendarIcon />Start Sequence</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Single email modal ── */}
      {modalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !generating && !sending && setModalLead(null)} />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Email to {modalLead.name}</h2>
                <p className="mt-0.5 text-xs text-slate-400">{[modalLead.company, modalLead.title].filter(Boolean).join(" · ")}</p>
              </div>
              <button onClick={() => setModalLead(null)} disabled={generating || sending} className="rounded-lg p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-40">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {generating && (
                <div className="flex items-center justify-center gap-2.5 py-14 text-sm text-slate-500">
                  <Spinner />Generating personalized email with AI…
                </div>
              )}
              {!generating && modalError && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{modalError}</div>
              )}
              {!generating && modalSent && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Email sent successfully!
                </div>
              )}
              {!generating && !modalSent && emailSubject && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</label>
                    <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Body</label>
                    <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={8} className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-sm leading-relaxed text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  </div>
                </>
              )}
            </div>

            {!generating && !modalSent && (
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
                <button onClick={() => setModalLead(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300">Cancel</button>
                <button onClick={handleSendSingle} disabled={sending || !emailSubject.trim() || !emailBody.trim()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {sending ? (
                    <><Spinner />Sending…</>
                  ) : (
                    <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>Send Now</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

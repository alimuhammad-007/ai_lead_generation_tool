"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type AgentRun = {
  id:      string;
  label:   string;
  ts:      number;
  status:  "running" | "done" | "error";
  summary: string;
};

type QualifyResult = {
  qualified:        number;
  hot:              number;
  warm:             number;
  cold:             number;
  sequencesStarted: number;
  researched:       number;
  message?:         string;
};

type ReportResult = {
  report:    string;
  emailSent: boolean;
  sentTo:    string;
  stats: {
    newLeads:   number;
    emailsSent: number;
    replies:    number;
    hotTotal:   number;
  };
};

type OutreachResult = {
  processed:        number;
  skipped:          number;
  emailsSent:       number;
  linkedinMessages: number;
  whatsAppMessages: number;
  message?:         string;
};

type MeetingResult = {
  processed:  number;
  emailsSent: number;
  skipped:    number;
  meetingLink: string;
  message?:   string;
};

type FollowUpResult = {
  followed_up: number;
  skipped:     number;
  message?:    string;
};

type MonitorResult = {
  found:    number;
  imported: number;
  hot:      number;
  warm:     number;
  cold:     number;
  message?: string;
};

const STORAGE_KEY = "apex_agent_runs";
const MAX_LOG     = 8;

// ── Helpers ────────────────────────────────────────────────────────────────────

function loadLog(): AgentRun[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

function saveLog(runs: AgentRun[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(0, MAX_LOG)));
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ── Dropdown item sub-component ───────────────────────────────────────────────

function MenuItem({
  emoji, bg, hover, label, desc, onClick,
}: {
  emoji: string; bg: string; hover: string;
  label: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${hover}`}
    >
      <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${bg} text-sm`}>
        {emoji}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{desc}</p>
      </div>
    </button>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function RunAgentsButton() {
  const [open,         setOpen]         = useState(false);
  const [loading,      setLoading]      = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState<string>("");
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);
  const [log,          setLog]          = useState<AgentRun[]>([]);
  const [showLog,      setShowLog]      = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLog(loadLog()); }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  function pushLog(run: AgentRun) {
    setLog((prev) => {
      const next = [run, ...prev].slice(0, MAX_LOG);
      saveLog(next);
      return next;
    });
  }

  // ── Generic agent runner helper ──────────────────────────────────────────────
  async function runAgent<T>(opts: {
    key:         string;
    label:       string;
    startLabel:  string;
    fetch:       () => Promise<T>;
    summarize:   (data: T) => string;
  }) {
    setOpen(false);
    setLoading(opts.key);
    setLoadingLabel(opts.startLabel);
    const runId = Date.now().toString();
    pushLog({ id: runId, label: opts.label, ts: Date.now(), status: "running", summary: opts.startLabel });

    try {
      const data    = await opts.fetch();
      const summary = opts.summarize(data);
      pushLog({ id: runId, label: opts.label, ts: Date.now(), status: "done", summary });
      setToast({ msg: summary, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Agent failed";
      pushLog({ id: runId, label: opts.label, ts: Date.now(), status: "error", summary: msg });
      setToast({ msg, ok: false });
    } finally {
      setLoading(null);
      setLoadingLabel("");
    }
  }

  // ── Agent runners ─────────────────────────────────────────────────────────────

  const runQualify = () => runAgent<QualifyResult>({
    key:        "qualify",
    label:      "Qualify All Unscored Leads",
    startLabel: "Qualifying leads…",
    fetch: () =>
      fetch("/api/agents/qualify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runAll: true }),
      }).then((r) => r.json()),
    summarize: (d) =>
      d.message
        ? d.message
        : `Qualified ${d.qualified} lead(s): ${d.hot} hot, ${d.warm} warm, ${d.cold} cold. ${d.sequencesStarted} sequence(s) started.`,
  });

  const runDailyReport = () => runAgent<ReportResult>({
    key:        "report",
    label:      "Send Daily Report",
    startLabel: "Generating report…",
    fetch: () => fetch("/api/agents/daily-report").then((r) => r.json()),
    summarize: (d) =>
      d.emailSent
        ? `Report sent to ${d.sentTo}. ${d.stats.newLeads} new leads, ${d.stats.emailsSent} emails, ${d.stats.replies} replies.`
        : `Report generated (email not sent). ${d.stats.newLeads} new leads, ${d.stats.emailsSent} emails.`,
  });

  const runAutoOutreach = () => runAgent<OutreachResult>({
    key:        "outreach",
    label:      "Auto Outreach Hot Leads",
    startLabel: "Reaching out to hot leads…",
    fetch: () =>
      fetch("/api/agents/auto-outreach", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runAll: true, channels: ["email", "linkedin", "whatsapp"] }),
      }).then((r) => r.json()),
    summarize: (d) =>
      d.message
        ? d.message
        : `Reached ${d.processed} hot lead(s): ${d.emailsSent} email${d.emailsSent !== 1 ? "s" : ""}, ${d.linkedinMessages} LinkedIn, ${d.whatsAppMessages} WhatsApp.${d.skipped > 0 ? ` (${d.skipped} skipped)` : ""}`,
  });

  const runMeetingBooker = () => runAgent<MeetingResult>({
    key:        "meetings",
    label:      "Book Meetings with Hot Leads",
    startLabel: "Booking meetings…",
    fetch: () =>
      fetch("/api/agents/meeting-booker", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runAll: true }),
      }).then((r) => r.json()),
    summarize: (d) =>
      d.message
        ? d.message
        : `Sent ${d.emailsSent} meeting request${d.emailsSent !== 1 ? "s" : ""} to hot leads.${d.skipped > 0 ? ` (${d.skipped} skipped — no email or contacted recently)` : ""}`,
  });

  const runFollowUp = () => runAgent<FollowUpResult>({
    key:        "followup",
    label:      "Follow-up Unresponsive Leads",
    startLabel: "Finding unresponsive leads…",
    fetch: () =>
      fetch("/api/agents/followup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runAll: true }),
      }).then((r) => r.json()),
    summarize: (d) =>
      d.message
        ? d.message
        : `Sent ${d.followed_up} follow-up email${d.followed_up !== 1 ? "s" : ""}.${d.skipped > 0 ? ` ${d.skipped} skipped.` : ""}`,
  });

  const runMonitor = () => runAgent<MonitorResult>({
    key:        "monitor",
    label:      "Find New Leads Automatically",
    startLabel: "Scanning for new leads…",
    fetch: () =>
      fetch("/api/agents/monitor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoImport: true }),
      }).then((r) => r.json()),
    summarize: (d) =>
      d.message
        ? d.message
        : `Found ${d.found} new lead${d.found !== 1 ? "s" : ""}, imported ${d.imported}: ${d.hot} hot, ${d.warm} warm, ${d.cold} cold.`,
  });

  const isLoading   = loading !== null;
  const buttonLabel = isLoading ? (loadingLabel || "Running…") : "Run Agents";

  return (
    <div className="relative flex items-center gap-2">

      {/* ── Activity log toggle ── */}
      {log.length > 0 && (
        <button
          onClick={() => setShowLog((v) => !v)}
          title="Agent activity log"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {log.some((r) => r.status === "running") && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-white" />
          )}
        </button>
      )}

      {/* ── Activity log panel ── */}
      {showLog && log.length > 0 && (
        <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-xs font-semibold text-slate-700">Agent Activity</span>
            <button
              onClick={() => { setLog([]); saveLog([]); setShowLog(false); }}
              className="text-[11px] text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          </div>
          <ul className="max-h-72 divide-y divide-slate-50 overflow-y-auto">
            {log.map((run) => (
              <li key={run.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 text-base">
                  {run.status === "running" ? "⏳" : run.status === "done" ? "✅" : "❌"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800">{run.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{run.summary}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{timeAgo(run.ts)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Run Agents dropdown button ── */}
      <div ref={dropRef} className="relative">
        <button
          onClick={() => !isLoading && setOpen((v) => !v)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-200 transition-all hover:shadow-md disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="max-w-[180px] truncate">{buttonLabel}</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Agents
              <svg className="h-3.5 w-3.5 opacity-70" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">

            {/* ── Section 1: Lead management ── */}
            <div className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Lead Management
            </div>

            <MenuItem emoji="🎯" bg="bg-indigo-100" hover="hover:bg-indigo-50"
              label="Qualify All Unscored Leads"
              desc="AI-score + ICP + research. Auto-starts sequences for leads ≥ 70."
              onClick={runQualify}
            />
            <div className="mx-4 border-t border-slate-100" />
            <MenuItem emoji="🔍" bg="bg-emerald-100" hover="hover:bg-emerald-50"
              label="Find New Leads Automatically"
              desc="Scan Google for new ICP-matching leads and auto-import them."
              onClick={runMonitor}
            />

            {/* ── Section 2: Outreach ── */}
            <div className="mx-4 mt-1 border-t border-slate-200" />
            <div className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Outreach
            </div>

            <MenuItem emoji="🚀" bg="bg-rose-100" hover="hover:bg-rose-50"
              label="Auto Outreach Hot Leads"
              desc="Send email + LinkedIn + WhatsApp to all hot leads (score ≥ 50)."
              onClick={runAutoOutreach}
            />
            <div className="mx-4 border-t border-slate-100" />
            <MenuItem emoji="📅" bg="bg-sky-100" hover="hover:bg-sky-50"
              label="Book Meetings with Hot Leads"
              desc="Send personalized Calendly meeting requests to hot leads."
              onClick={runMeetingBooker}
            />
            <div className="mx-4 border-t border-slate-100" />
            <MenuItem emoji="🔄" bg="bg-amber-100" hover="hover:bg-amber-50"
              label="Follow-up Unresponsive Leads"
              desc="Re-engage leads with no reply 3+ days after first email."
              onClick={runFollowUp}
            />

            {/* ── Section 3: Reporting ── */}
            <div className="mx-4 mt-1 border-t border-slate-200" />
            <div className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Reporting
            </div>

            <MenuItem emoji="📊" bg="bg-violet-100" hover="hover:bg-violet-50"
              label="Send Daily Report"
              desc="Compile today's stats and send an AI-written summary email."
              onClick={runDailyReport}
            />
            <div className="h-1" />
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] flex max-w-sm items-start gap-3 rounded-2xl px-5 py-4 shadow-xl ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          <span className="mt-0.5 flex-shrink-0 text-lg">{toast.ok ? "✅" : "❌"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{toast.ok ? "Agent complete" : "Agent error"}</p>
            <p className="mt-0.5 text-xs leading-snug opacity-90">{toast.msg}</p>
          </div>
          <button onClick={() => setToast(null)} className="flex-shrink-0 opacity-70 hover:opacity-100">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

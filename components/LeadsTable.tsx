"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScoreButton } from "@/components/ScoreButton";
import { Lead, LeadStatus } from "@/types/database";

interface Props {
  leads: Lead[];
}

// ── Style maps ────────────────────────────────────────────────────────────────

const SCORE_CLS: Record<LeadStatus, string> = {
  hot:      "bg-rose-50   text-rose-600   ring-rose-300",
  warm:     "bg-amber-50  text-amber-600  ring-amber-300",
  cold:     "bg-blue-50   text-blue-600   ring-blue-300",
  unscored: "bg-slate-50  text-slate-400  ring-slate-200 ring-dashed",
};

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

function Th({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 ${center ? "text-center" : "text-left"}`}>
      {children}
    </th>
  );
}

function ScoreBadge({ score, status }: { score: number; status: LeadStatus }) {
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ring-2 ${SCORE_CLS[status]}`}>
      {status === "unscored" ? "—" : score}
    </span>
  );
}

function StatusPill({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${STATUS_PILL_CLS[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {status}
    </span>
  );
}

function InitialsAvatar({ name, status }: { name: string; status: LeadStatus }) {
  const ini = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${AVATAR_CLS[status]}`}>
      {ini}
    </span>
  );
}

function Spinner({ sm }: { sm?: boolean }) {
  const cls = sm ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <svg className={`${cls} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function MailIcon({ cls = "h-3.5 w-3.5" }: { cls?: string }) {
  return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasRealEmail(lead: Lead): lead is Lead & { email: string } {
  return !!(lead.email && lead.email !== "unknown@unknown.com");
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
  const [bulkSending, setBulkSending]   = useState(false);
  const [bulkResult, setBulkResult]     = useState<{ sent: number; failed: number } | null>(null);

  // ── Selection helpers ──────────────────────────────────────────────────────

  const emailableLeads       = leads.filter(hasRealEmail);
  const allEmailableSelected =
    emailableLeads.length > 0 && emailableLeads.every((l) => selected.has(l.id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allEmailableSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(emailableLeads.map((l) => l.id)));
    }
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
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, generate_only: true }),
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
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: modalLead.id,
          generate_only: false,
          subject: emailSubject,
          body: emailBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setModalSent(true);
      setTimeout(() => {
        setModalLead(null);
        router.refresh();
      }, 1800);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  }

  // ── Bulk send ──────────────────────────────────────────────────────────────

  async function handleBulkSend() {
    setBulkSending(true);
    setBulkResult(null);

    try {
      const res = await fetch("/api/outreach/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selected) }),
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
              <>
                <Spinner sm />
                Sending {selected.size}…
              </>
            ) : (
              <>
                <MailIcon />
                Generate &amp; Send Emails
              </>
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
          <table className="min-w-full divide-y divide-slate-50 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allEmailableSelected}
                    onChange={toggleSelectAll}
                    title="Select all emailable leads"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                </th>
                <Th>Name</Th>
                <Th>Company</Th>
                <Th>Title</Th>
                <Th>Email</Th>
                <Th center>Score</Th>
                <Th center>Status</Th>
                <Th>AI Reason</Th>
                <Th>Added</Th>
                <Th center>Action</Th>
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
                    <td className="px-4 py-3">
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

                    {/* Name + initials */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={lead.name} status={lead.status} />
                        <div className="min-w-0">
                          <p className="max-w-[130px] truncate font-medium text-slate-900">{lead.name}</p>
                          <p className="max-w-[130px] truncate text-xs text-slate-400">{lead.title ?? "—"}</p>
                        </div>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="max-w-[120px] truncate px-4 py-3 text-slate-600">
                      {lead.company ?? "—"}
                    </td>

                    {/* Title */}
                    <td className="max-w-[140px] truncate px-4 py-3 text-slate-500">
                      {lead.title ?? "—"}
                    </td>

                    {/* Email */}
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                      {lead.email ?? "—"}
                    </td>

                    {/* Score badge */}
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={lead.score} status={lead.status} />
                    </td>

                    {/* Status pill */}
                    <td className="px-4 py-3 text-center">
                      <StatusPill status={lead.status} />
                    </td>

                    {/* AI reason */}
                    <td className="px-4 py-3">
                      <span
                        className="line-clamp-2 block max-w-[180px] text-xs text-slate-400"
                        title={lead.score_reason ?? undefined}
                      >
                        {lead.score_reason ?? "—"}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <ScoreButton
                          leadIds={[lead.id]}
                          label={lead.status === "unscored" ? "Score" : "Re-score"}
                          variant="ghost"
                        />
                        {canEmail && (
                          <button
                            onClick={() => openEmailModal(lead)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                          >
                            <MailIcon />
                            Send Email
                          </button>
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

      {/* ── Single email modal ── */}
      {modalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !generating && !sending && setModalLead(null)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Email to {modalLead.name}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {[modalLead.company, modalLead.title].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                onClick={() => setModalLead(null)}
                disabled={generating || sending}
                className="rounded-lg p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-40"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 px-6 py-5">
              {/* Loading */}
              {generating && (
                <div className="flex items-center justify-center gap-2.5 py-14 text-sm text-slate-500">
                  <Spinner />
                  Generating personalized email with AI…
                </div>
              )}

              {/* Error */}
              {!generating && modalError && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {modalError}
                </div>
              )}

              {/* Success */}
              {!generating && modalSent && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Email sent successfully!
                </div>
              )}

              {/* Editable fields */}
              {!generating && !modalSent && emailSubject && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Body
                    </label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={8}
                      className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-sm leading-relaxed text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!generating && !modalSent && (
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
                <button
                  onClick={() => setModalLead(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendSingle}
                  disabled={sending || !emailSubject.trim() || !emailBody.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <Spinner />
                      Sending…
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send Now
                    </>
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

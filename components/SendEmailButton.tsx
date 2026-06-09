"use client";

import { useState } from "react";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  title: string | null;
}

export function SendEmailButton({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function openModal() {
    setOpen(true);
    setGenerating(true);
    setError(null);
    setSent(false);
    setSubject("");
    setBody("");

    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, generate_only: true }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to generate email");
        return;
      }
      setSubject(data.subject ?? "");
      setBody(data.body ?? "");
    } catch {
      setError("Network error — please try again");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: lead.id,
          generate_only: false,
          subject_override: subject,
          body_override: body,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to send email");
        return;
      }
      setSent(true);
      setTimeout(() => setOpen(false), 1800);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSending(false);
    }
  }

  function close() {
    if (!generating && !sending) setOpen(false);
  }

  return (
    <>
      <button
        onClick={openModal}
        title="Send email"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Email
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={close}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Email to {lead.name}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {[lead.company, lead.email].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                onClick={close}
                disabled={generating || sending}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-700 disabled:opacity-40"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 px-6 py-5">
              {generating && (
                <div className="flex items-center justify-center gap-2.5 py-14 text-sm text-slate-500">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating personalized email with AI…
                </div>
              )}

              {!generating && error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  {error}
                </div>
              )}

              {!generating && sent && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Email sent successfully!
                </div>
              )}

              {!generating && !sent && subject && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Email Body
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={12}
                      className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-sm leading-relaxed text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!generating && !sent && (
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
                <button
                  onClick={close}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !subject.trim() || !body.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send Email
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

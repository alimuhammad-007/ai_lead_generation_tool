import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase";
import { OutreachEmailStatus } from "@/types/database";

export const dynamic = "force-dynamic";

// ── Style maps ────────────────────────────────────────────────────────────────

const STATUS_TABS: Array<{ label: string; value: OutreachEmailStatus | "all" }> = [
  { label: "All",       value: "all"       },
  { label: "Sent",      value: "sent"      },
  { label: "Opened",    value: "opened"    },
  { label: "Replied",   value: "replied"   },
  { label: "Failed",    value: "failed"    },
  { label: "Scheduled", value: "scheduled" },
];

const STATUS_PILL: Record<OutreachEmailStatus, string> = {
  scheduled: "bg-slate-100  text-slate-600  ring-slate-200",
  sent:      "bg-emerald-50 text-emerald-700 ring-emerald-200",
  opened:    "bg-blue-50    text-blue-700   ring-blue-200",
  replied:   "bg-violet-50  text-violet-700 ring-violet-200",
  failed:    "bg-rose-50    text-rose-700   ring-rose-200",
};

const STATUS_DOT: Record<OutreachEmailStatus, string> = {
  scheduled: "bg-slate-400",
  sent:      "bg-emerald-500",
  opened:    "bg-blue-500",
  replied:   "bg-violet-500",
  failed:    "bg-rose-500",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OutreachPage({
  searchParams,
}: {
  searchParams?: { status?: string | string[]; section?: string };
}) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const section      = searchParams?.section ?? "emails";
  const rawStatus    = Array.isArray(searchParams?.status) ? searchParams!.status[0] : (searchParams?.status ?? "all");
  const activeFilter = rawStatus as OutreachEmailStatus | "all";

  // ── Shared stats query ─────────────────────────────────────────────────────
  const { data: allEmails } = await supabase
    .from("outreach_emails")
    .select("id, status, sent_at, lead_id")
    .eq("user_id", user.id);

  const counts = { scheduled: 0, sent: 0, opened: 0, replied: 0, failed: 0, total: 0 };
  for (const e of allEmails ?? []) {
    counts[e.status as OutreachEmailStatus]++;
    counts.total++;
  }

  const todayStart  = new Date(); todayStart.setHours(0, 0, 0, 0);
  const sentToday   = (allEmails ?? []).filter(
    (e) => e.status === "sent" && e.sent_at && new Date(e.sent_at) >= todayStart
  ).length;
  const activeSets  = new Set((allEmails ?? []).filter((e) => e.status === "scheduled").map((e) => e.lead_id));
  const activeSeqs  = activeSets.size;

  // ── Sequences section data ─────────────────────────────────────────────────
  const adminDb = createAdminClient();

  const { data: scheduledEmails } = await adminDb
    .from("outreach_emails")
    .select("id, subject, scheduled_for, sequence_day, leads(name, email, company)")
    .eq("user_id", user.id)
    .eq("status", "scheduled")
    .order("scheduled_for", { ascending: true })
    .limit(200);

  // ── Email list data ────────────────────────────────────────────────────────
  let tableQuery = supabase
    .from("outreach_emails")
    .select("*, leads(name, email, company)")
    .eq("user_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(200);

  if (activeFilter !== "all") tableQuery = tableQuery.eq("status", activeFilter);
  const { data: emails } = await tableQuery;

  // ── Server action: cancel a scheduled email ────────────────────────────────
  async function cancelEmail(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id) return;
    const db = createAdminClient();
    const sv = createServerSupabaseClient();
    const { data: { user: u } } = await sv.auth.getUser();
    if (!u) return;
    await db
      .from("outreach_emails")
      .delete()
      .eq("id", id)
      .eq("user_id", u.id)
      .eq("status", "scheduled");
    revalidatePath("/outreach");
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const tabCount = (v: OutreachEmailStatus | "all") => v === "all" ? counts.total : counts[v] ?? 0;

  return (
    <main className="min-h-screen p-6 lg:p-8">

      {/* ── Header ── */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Email Outreach</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {counts.total} email{counts.total !== 1 ? "s" : ""} · {activeSeqs} active sequence{activeSeqs !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/leads"
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:bg-indigo-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Start Sequence
          </Link>
          <Link
            href="/leads"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send Email
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {(
          [
            { label: "Sent",             value: counts.sent,      cls: "text-emerald-700" },
            { label: "Opened",           value: counts.opened,    cls: "text-blue-700"    },
            { label: "Replied",          value: counts.replied,   cls: "text-violet-700"  },
            { label: "Failed",           value: counts.failed,    cls: "text-rose-600"    },
            { label: "Scheduled",        value: counts.scheduled, cls: "text-slate-600"   },
            { label: "Active Sequences", value: activeSeqs,       cls: "text-indigo-700"  },
            { label: "Emails Queued",    value: counts.scheduled, cls: "text-amber-700"   },
            { label: "Sent Today",       value: sentToday,        cls: "text-teal-700"    },
          ] as const
        ).map(({ label, value, cls }) => (
          <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Top-level section tabs ── */}
      <div className="mb-0 flex gap-0.5 border-b border-slate-200">
        {(["emails", "sequences"] as const).map((s) => (
          <Link
            key={s}
            href={s === "emails" ? "/outreach" : "/outreach?section=sequences"}
            className={[
              "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors",
              section === s
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
            ].join(" ")}
          >
            {s === "emails" ? (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Emails
                <span className={["rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums", section === "emails" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"].join(" ")}>
                  {counts.total}
                </span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Sequences
                <span className={["rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums", section === "sequences" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"].join(" ")}>
                  {counts.scheduled}
                </span>
              </>
            )}
          </Link>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION: SEQUENCES
      ════════════════════════════════════════════════════════════════════════ */}
      {section === "sequences" && (
        <div className="overflow-hidden rounded-b-2xl rounded-tr-2xl border border-t-0 border-slate-100 bg-white shadow-sm">
          {!scheduledEmails || scheduledEmails.length === 0 ? (
            <div className="py-20 text-center">
              <svg className="mx-auto mb-4 h-12 w-12 text-slate-200" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium text-slate-500">No scheduled emails</p>
              <p className="mt-1 text-xs text-slate-400">
                Go to{" "}
                <Link href="/leads" className="text-indigo-600 hover:underline">Leads</Link>
                {" "}and click the{" "}
                <span className="font-semibold">📅</span> icon on a lead to start a sequence.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Lead", "Subject", "Sequence Day", "Scheduled", "Due In", ""].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {scheduledEmails.map((email) => {
                    const lead   = Array.isArray(email.leads) ? email.leads[0] : email.leads;
                    const days   = daysUntil(email.scheduled_for);
                    const isDue  = days === 0;
                    return (
                      <tr key={email.id} className="transition-colors hover:bg-slate-50/60">
                        {/* Lead */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                              {lead?.name ? lead.name.slice(0, 2).toUpperCase() : "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-[130px] truncate font-medium text-slate-900">{lead?.name ?? "—"}</p>
                              <p className="max-w-[130px] truncate text-xs text-slate-400">{lead?.company ?? ""}</p>
                            </div>
                          </div>
                        </td>

                        {/* Subject */}
                        <td className="max-w-[220px] truncate px-5 py-3.5 text-slate-700" title={email.subject ?? undefined}>
                          {email.subject ?? "—"}
                        </td>

                        {/* Sequence day */}
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                            Day {email.sequence_day ?? "—"}
                          </span>
                        </td>

                        {/* Scheduled date */}
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500">
                          {fmtDate(email.scheduled_for)}
                        </td>

                        {/* Days until */}
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <span className={[
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                            isDue
                              ? "bg-amber-50 text-amber-700 ring-amber-200"
                              : days <= 2
                              ? "bg-rose-50 text-rose-700 ring-rose-200"
                              : "bg-slate-50 text-slate-600 ring-slate-200",
                          ].join(" ")}>
                            {isDue ? "Due now" : `${days}d`}
                          </span>
                        </td>

                        {/* Cancel */}
                        <td className="px-5 py-3.5 text-right">
                          <form action={cancelEmail}>
                            <input type="hidden" name="id" value={email.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                            >
                              Cancel
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION: EMAILS
      ════════════════════════════════════════════════════════════════════════ */}
      {section === "emails" && (
        <div className="overflow-hidden rounded-b-2xl rounded-tr-2xl border border-t-0 border-slate-100 bg-white shadow-sm">
          {/* Status filter tabs */}
          <div className="border-b border-slate-100 px-6 pt-4">
            <div className="-mb-px flex gap-0.5">
              {STATUS_TABS.map((tab) => {
                const active = activeFilter === tab.value;
                const href   = tab.value === "all" ? "/outreach" : `/outreach?status=${tab.value}`;
                return (
                  <Link
                    key={tab.value}
                    href={href}
                    className={[
                      "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
                    ].join(" ")}
                  >
                    {tab.label}
                    <span className={["rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums", active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"].join(" ")}>
                      {tabCount(tab.value)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Table / empty state */}
          {!emails || emails.length === 0 ? (
            <div className="py-20 text-center">
              <svg className="mx-auto mb-4 h-12 w-12 text-slate-200" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium text-slate-500">
                {activeFilter === "all" ? "No emails yet" : `No ${activeFilter} emails`}
              </p>
              {activeFilter === "all" && (
                <p className="mt-1 text-xs text-slate-400">
                  Go to{" "}
                  <Link href="/leads" className="text-indigo-600 hover:underline">Leads</Link>
                  {" "}and click <strong>Send Email</strong> on any lead to get started.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Lead", "Email", "Subject", "Status", "Sent"].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {emails.map((email) => {
                    const lead   = Array.isArray(email.leads) ? email.leads[0] : email.leads;
                    const status = email.status as OutreachEmailStatus;
                    return (
                      <tr key={email.id} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                              {lead?.name ? lead.name.slice(0, 2).toUpperCase() : "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-[140px] truncate font-medium text-slate-900">{lead?.name ?? "—"}</p>
                              <p className="max-w-[140px] truncate text-xs text-slate-400">{lead?.company ?? ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-3.5 font-mono text-xs text-slate-500">{lead?.email ?? "—"}</td>
                        <td className="max-w-[240px] truncate px-6 py-3.5 text-slate-700" title={email.subject ?? undefined}>{email.subject ?? "—"}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_PILL[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status] ?? "bg-slate-400"}`} />
                            {status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-3.5 text-xs text-slate-500">
                          {email.sent_at ? new Date(email.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </main>
  );
}

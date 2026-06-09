import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Lead, LeadStatus } from "@/types/database";
import { ScoreButton } from "@/components/ScoreButton";
import { LeadsTable } from "@/components/LeadsTable";

export const dynamic = "force-dynamic";

// ── Status tabs config ────────────────────────────────────────────────────────

const STATUS_TABS: Array<{ label: string; value: LeadStatus | "all" }> = [
  { label: "All",      value: "all"      },
  { label: "Hot",      value: "hot"      },
  { label: "Warm",     value: "warm"     },
  { label: "Cold",     value: "cold"     },
  { label: "Unscored", value: "unscored" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: { status?: string | string[]; search?: string | string[] };
}) {
  const supabase = createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rawStatus = Array.isArray(searchParams?.status)
    ? searchParams!.status[0]
    : (searchParams?.status ?? "all");
  const activeTab = rawStatus as LeadStatus | "all";

  const rawSearch = Array.isArray(searchParams?.search)
    ? searchParams!.search[0]
    : (searchParams?.search ?? "");

  // ── Filtered lead query ────────────────────────────────────────────────────
  let query = supabase
    .from("leads")
    .select("*")
    .eq("user_id", user.id)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (activeTab !== "all") query = query.eq("status", activeTab);

  if (rawSearch) {
    query = query.or(
      `name.ilike.%${rawSearch}%,company.ilike.%${rawSearch}%,email.ilike.%${rawSearch}%`
    );
  }

  const { data: rows, error } = await query;
  if (error) throw error;
  const leads = (rows ?? []) as Lead[];

  // ── Status counts ──────────────────────────────────────────────────────────
  const { data: allStatuses } = await supabase
    .from("leads")
    .select("status")
    .eq("user_id", user.id);
  const counts = (allStatuses ?? []).reduce<Record<string, number>>(
    (acc, { status }) => {
      acc[status] = (acc[status] ?? 0) + 1;
      acc.all     = (acc.all     ?? 0) + 1;
      return acc;
    },
    {}
  );

  const unscoredCount = counts.unscored ?? 0;

  function tabHref(value: LeadStatus | "all") {
    const base = value === "all" ? "/leads" : `/leads?status=${value}`;
    return rawSearch
      ? `${base}${value === "all" ? "?" : "&"}search=${encodeURIComponent(rawSearch)}`
      : base;
  }

  return (
    <main className="min-h-screen p-6 lg:p-8">
      {/* ── Page header ── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {counts.all ?? 0} total
            {unscoredCount > 0 && (
              <> &mdash; <span className="text-amber-600">{unscoredCount} awaiting scoring</span></>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unscoredCount > 0 && (
            <ScoreButton
              scoreAllUnscored
              label={`Score ${unscoredCount} unscored`}
              variant="primary"
            />
          )}
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Lead
          </Link>
        </div>
      </div>

      {/* ── Mini stat cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStatCard label="Hot Leads"  count={counts.hot      ?? 0} dotCls="bg-rose-500"  valueCls="text-rose-700"  />
        <MiniStatCard label="Warm Leads" count={counts.warm     ?? 0} dotCls="bg-amber-400" valueCls="text-amber-700" />
        <MiniStatCard label="Cold Leads" count={counts.cold     ?? 0} dotCls="bg-blue-400"  valueCls="text-blue-700"  />
        <MiniStatCard label="Unscored"   count={counts.unscored ?? 0} dotCls="bg-slate-300" valueCls="text-slate-600" />
      </div>

      {/* ── Search + filter row ── */}
      <div className="mb-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form method="GET" action="/leads" className="flex w-full max-w-sm items-center gap-2">
          {activeTab !== "all" && (
            <input type="hidden" name="status" value={activeTab} />
          )}
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              name="search"
              defaultValue={rawSearch}
              placeholder="Search name, company, email…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Search
          </button>
          {rawSearch && (
            <a
              href={activeTab === "all" ? "/leads" : `/leads?status=${activeTab}`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-500 shadow-sm transition hover:text-slate-800"
            >
              ✕
            </a>
          )}
        </form>

        {rawSearch && (
          <p className="text-sm text-slate-500">
            {leads.length} result{leads.length !== 1 ? "s" : ""} for &ldquo;{rawSearch}&rdquo;
          </p>
        )}
      </div>

      {/* ── Status tabs ── */}
      <div className="mt-4 flex gap-0.5 border-b border-slate-200">
        {STATUS_TABS.map((tab) => {
          const active = activeTab === tab.value;
          return (
            <Link
              key={tab.value}
              href={tabHref(tab.value)}
              className={[
                "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
              ].join(" ")}
            >
              {tab.label}
              <span
                className={[
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500",
                ].join(" ")}
              >
                {tab.value === "all" ? (counts.all ?? 0) : (counts[tab.value] ?? 0)}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── Table / empty state ── */}
      <div className="mt-4">
        {leads.length === 0 ? (
          <EmptyState status={activeTab} search={rawSearch} />
        ) : (
          <LeadsTable leads={leads} />
        )}
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniStatCard({
  label,
  count,
  dotCls,
  valueCls,
}: {
  label: string;
  count: number;
  dotCls: string;
  valueCls: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotCls}`} />
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${valueCls}`}>{count}</p>
    </div>
  );
}

function EmptyState({
  status,
  search,
}: {
  status: LeadStatus | "all";
  search: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center shadow-sm">
      <svg
        className="mx-auto mb-4 h-12 w-12 text-slate-200"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      <p className="text-sm font-medium text-slate-600">
        {search
          ? `No leads found for "${search}"`
          : status === "all"
            ? "No leads yet"
            : `No ${status} leads`}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {search
          ? "Try a different search term or clear the filter"
          : "Get started by adding a lead or importing from CSV"}
      </p>
      {!search && status === "all" && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add a lead
          </Link>
          <Link
            href="/import"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
          >
            Import CSV
          </Link>
        </div>
      )}
    </div>
  );
}

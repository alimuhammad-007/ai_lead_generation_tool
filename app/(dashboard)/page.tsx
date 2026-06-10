import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { LeadsChart, type ChartDataPoint } from "@/components/LeadsChart";
import { AlertBanner } from "@/components/AlertBanner";
import { RunAgentsButton } from "@/components/RunAgentsButton";

export const dynamic = "force-dynamic";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const thirtyDaysAgo   = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const twentyFourHrsAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [leadsRes, emailsRes, chartLeadsRes, hotAlertRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id, status, name, company, score, created_at")
      .eq("user_id", user.id),
    supabase
      .from("outreach_emails")
      .select("id, status")
      .eq("user_id", user.id),
    supabase
      .from("leads")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: true }),
    // Hot leads from last 24 hours that haven't been alerted yet
    supabase
      .from("leads")
      .select("id, name, company")
      .eq("user_id", user.id)
      .eq("status", "hot")
      .gte("created_at", twentyFourHrsAgo)
      .is("alerted_at", null),
  ]);

  const leads      = leadsRes.data     ?? [];
  const emails     = emailsRes.data    ?? [];
  const hotAlerts  = hotAlertRes.data  ?? [];

  const totalLeads = leads.length;
  const hotLeads   = leads.filter((l) => l.status === "hot").length;
  const warmLeads  = leads.filter((l) => l.status === "warm").length;
  const coldLeads  = leads.filter((l) => l.status === "cold").length;

  const delivered = emails.filter((e) => ["sent", "opened", "replied"].includes(e.status)).length;
  const opened    = emails.filter((e) => ["opened", "replied"].includes(e.status)).length;
  const replied   = emails.filter((e) => e.status === "replied").length;
  const openRate  = delivered > 0 ? Math.round((opened  / delivered) * 100) : 0;
  const replyRate = delivered > 0 ? Math.round((replied / delivered) * 100) : 0;

  // 30-day chart bucketed by day
  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const l of chartLeadsRes.data ?? []) {
    const key = l.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const chartData: ChartDataPoint[] = Array.from(buckets.entries()).map(
    ([date, count]) => ({
      date: new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      leads: count,
    })
  );
  const chartTotal = chartData.reduce((s, d) => s + d.leads, 0);

  // 5 most recent leads for the table
  const recentLeads = [...leads]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <main className="min-h-screen p-6 lg:p-8">

      {/* ── Hot lead alert banner ── */}
      <AlertBanner
        count={hotAlerts.length}
        leads={hotAlerts as Array<{ id: string; name: string; company: string | null }>}
      />

      {/* ── Page header ── */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <RunAgentsButton />
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-md"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Lead
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Total Leads"
          value={totalLeads.toLocaleString()}
          sub="All time"
          gradient="from-blue-500 to-indigo-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <StatCard
          label="Hot Leads"
          value={hotLeads.toLocaleString()}
          sub={totalLeads > 0 ? `${Math.round((hotLeads / totalLeads) * 100)}% of total` : "—"}
          gradient="from-rose-500 to-orange-500"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
            </svg>
          }
        />
        <StatCard
          label="Emails Sent"
          value={delivered.toLocaleString()}
          sub={`${opened} opened`}
          gradient="from-violet-500 to-purple-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="Open Rate"
          value={`${openRate}%`}
          sub={`${opened} of ${delivered}`}
          gradient="from-emerald-500 to-green-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <StatCard
          label="Reply Rate"
          value={`${replyRate}%`}
          sub={`${replied} replies`}
          gradient="from-amber-500 to-orange-500"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          }
        />
      </div>

      {/* ── Chart + pipeline row ── */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Leads Over Time</h2>
              <p className="text-xs text-slate-400">New leads per day — last 30 days</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-slate-900">{chartTotal}</p>
              <p className="text-xs text-slate-400">this period</p>
            </div>
          </div>
          <LeadsChart data={chartData} />
        </div>

        {/* Pipeline */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Lead Pipeline</h3>
          <div className="space-y-4">
            <PipelineBar label="Hot"  count={hotLeads}  total={totalLeads} barCls="bg-rose-500"  dotCls="bg-rose-500"  />
            <PipelineBar label="Warm" count={warmLeads} total={totalLeads} barCls="bg-amber-400" dotCls="bg-amber-400" />
            <PipelineBar label="Cold" count={coldLeads} total={totalLeads} barCls="bg-blue-400"  dotCls="bg-blue-400"  />
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickAction
            href="/import"
            gradient="from-blue-500 to-indigo-600"
            label="Import Leads"
            desc="Bulk-add leads from a CSV file"
            icon={
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            }
          />
          <QuickAction
            href="/leads"
            gradient="from-violet-500 to-purple-600"
            label="Score All Leads"
            desc="Run AI scoring on unscored leads"
            icon={
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L4.09 12.97H11L9.5 22.02L20.5 11.03H13.5L13 2Z" />
              </svg>
            }
          />
          <QuickAction
            href="/outreach"
            gradient="from-emerald-500 to-green-600"
            label="Send Campaign"
            desc="Launch an email outreach sequence"
            icon={
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            }
          />
        </div>
      </div>

      {/* ── Recent leads ── */}
      {recentLeads.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent Leads</h2>
            <Link href="/leads" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentLeads.map((lead, i) => (
              <div
                key={lead.id ?? i}
                className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50/60"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                  {lead.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{lead.name}</p>
                  <p className="truncate text-xs text-slate-400">{lead.company ?? "—"}</p>
                </div>
                <StatusBadge status={lead.status as "hot" | "warm" | "cold" | null} />
                {lead.score != null && (
                  <span className="hidden tabular-nums text-xs font-semibold text-slate-400 sm:block">
                    {lead.score}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  gradient,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  gradient: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}>
        {icon}
      </div>
      <p className="mt-4 text-2xl font-bold tabular-nums text-slate-900 lg:text-3xl">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-600">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

function PipelineBar({
  label,
  count,
  total,
  barCls,
  dotCls,
}: {
  label: string;
  count: number;
  total: number;
  barCls: string;
  dotCls: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-medium text-slate-700">
          <span className={`h-2 w-2 rounded-full ${dotCls}`} />
          {label}
        </div>
        <span className="tabular-nums text-slate-500">
          {count} <span className="text-slate-400">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barCls} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuickAction({
  href,
  gradient,
  label,
  desc,
  icon,
}: {
  href: string;
  gradient: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60"
    >
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
      </div>
      <svg
        className="mt-1 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-slate-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

function StatusBadge({ status }: { status: "hot" | "warm" | "cold" | null }) {
  if (!status) return null;
  const styles = {
    hot:  "bg-rose-50 text-rose-700 ring-rose-200",
    warm: "bg-amber-50 text-amber-700 ring-amber-200",
    cold: "bg-blue-50 text-blue-700 ring-blue-200",
  };
  return (
    <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

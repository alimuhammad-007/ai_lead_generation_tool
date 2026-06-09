import { Lead } from "@/types/database";

type Status = Lead["status"];

// ── Style maps ────────────────────────────────────────────────────────────────

const AVATAR_CLS: Record<Status, string> = {
  hot:      "bg-rose-100  text-rose-700",
  warm:     "bg-amber-100 text-amber-700",
  cold:     "bg-blue-100  text-blue-700",
  unscored: "bg-slate-100 text-slate-500",
};

const SCORE_CLS: Record<Status, string> = {
  hot:      "bg-rose-50   text-rose-600   ring-rose-300",
  warm:     "bg-amber-50  text-amber-600  ring-amber-300",
  cold:     "bg-blue-50   text-blue-600   ring-blue-300",
  unscored: "bg-slate-50  text-slate-400  ring-slate-200 ring-dashed",
};

const STATUS_DOT: Record<Status, string> = {
  hot:      "bg-rose-500",
  warm:     "bg-amber-400",
  cold:     "bg-blue-400",
  unscored: "bg-slate-300",
};

const STATUS_PILL: Record<Status, string> = {
  hot:      "bg-rose-50  text-rose-700  ring-rose-200",
  warm:     "bg-amber-50 text-amber-700 ring-amber-200",
  cold:     "bg-blue-50  text-blue-700  ring-blue-200",
  unscored: "bg-slate-50 text-slate-500 ring-slate-200",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LeadTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center shadow-sm">
        <svg className="mx-auto mb-3 h-10 w-10 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <p className="text-sm font-medium text-slate-500">No leads yet</p>
        <p className="mt-1 text-xs text-slate-400">Add leads manually or import from CSV</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-50 text-sm">
          <thead>
            <tr className="bg-slate-50">
              <Th>Name</Th>
              <Th>Company</Th>
              <Th>Title</Th>
              <Th>Email</Th>
              <Th center>Score</Th>
              <Th center>Status</Th>
              <Th>Added</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {leads.map((lead) => (
              <tr key={lead.id} className="transition-colors hover:bg-slate-50/60">
                {/* Name + initials */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${AVATAR_CLS[lead.status]}`}>
                      {initials(lead.name)}
                    </span>
                    <span className="truncate font-medium text-slate-900 max-w-[130px]">{lead.name}</span>
                  </div>
                </td>
                <td className="max-w-[120px] truncate px-4 py-3 text-slate-600">{lead.company ?? "—"}</td>
                <td className="max-w-[140px] truncate px-4 py-3 text-slate-500">{lead.title ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{lead.email}</td>
                {/* Score ring */}
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-2 ${SCORE_CLS[lead.status]}`}>
                    {lead.status === "unscored" ? "—" : lead.score}
                  </span>
                </td>
                {/* Status pill */}
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${STATUS_PILL[lead.status]}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[lead.status]}`} />
                    {lead.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                  {new Date(lead.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 ${center ? "text-center" : "text-left"}`}>
      {children}
    </th>
  );
}

import { Lead } from "@/types/database";

type Status = Lead["status"];

const SCORE_RING: Record<Status, string> = {
  hot:      "bg-rose-50  text-rose-600  ring-rose-300",
  warm:     "bg-amber-50 text-amber-600 ring-amber-300",
  cold:     "bg-blue-50  text-blue-600  ring-blue-300",
  unscored: "bg-slate-50 text-slate-400 ring-slate-200 ring-dashed",
};

const STATUS_PILL: Record<Status, string> = {
  hot:      "bg-rose-50  text-rose-700  ring-rose-200",
  warm:     "bg-amber-50 text-amber-700 ring-amber-200",
  cold:     "bg-blue-50  text-blue-700  ring-blue-200",
  unscored: "bg-slate-50 text-slate-500 ring-slate-200",
};

const STATUS_DOT: Record<Status, string> = {
  hot:      "bg-rose-500",
  warm:     "bg-amber-400",
  cold:     "bg-blue-400",
  unscored: "bg-slate-300",
};

const AVATAR_CLS: Record<Status, string> = {
  hot:      "bg-rose-100  text-rose-700",
  warm:     "bg-amber-100 text-amber-700",
  cold:     "bg-blue-100  text-blue-700",
  unscored: "bg-slate-100 text-slate-500",
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("");
}

export function LeadCard({ lead }: { lead: Lead }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60">
      {/* Top shimmer on hover */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3">
        {/* Left: avatar + info */}
        <div className="flex items-start gap-3 min-w-0">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${AVATAR_CLS[lead.status]}`}>
            {initials(lead.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{lead.name}</p>
            <p className="truncate text-xs text-slate-500">{lead.title ?? "—"}</p>
            <p className="truncate text-xs text-slate-400">{lead.company ?? "—"}</p>
          </div>
        </div>

        {/* Right: score ring + status */}
        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ring-2 ${SCORE_RING[lead.status]}`}>
            {lead.status === "unscored" ? "—" : lead.score}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ${STATUS_PILL[lead.status]}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[lead.status]}`} />
            {lead.status}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
        <span className="truncate font-mono text-xs text-slate-400">{lead.email}</span>
        {lead.linkedin_url && (
          <a
            href={lead.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 flex-shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            LinkedIn ↗
          </a>
        )}
      </div>
    </div>
  );
}

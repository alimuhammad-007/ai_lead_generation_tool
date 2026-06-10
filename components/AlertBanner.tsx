"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  count: number;
  leads: Array<{ id: string; name: string; company: string | null }>;
}

export function AlertBanner({ count, leads }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || count === 0) return null;

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-orange-50 px-5 py-3.5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        {/* Pulsing fire badge */}
        <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-rose-100">
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-300 opacity-40" />
          <span className="text-lg">🔥</span>
        </span>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-rose-900">
            {count} new hot lead{count !== 1 ? "s" : ""} today!
          </p>
          {leads.length > 0 && (
            <p className="mt-0.5 truncate text-xs text-rose-600">
              {leads
                .slice(0, 3)
                .map((l) => l.name + (l.company ? ` · ${l.company}` : ""))
                .join(",  ")}
              {leads.length > 3 && ` +${leads.length - 3} more`}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <Link
          href="/leads?status=hot"
          className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
        >
          View leads →
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1.5 text-rose-400 transition hover:text-rose-700"
          title="Dismiss"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

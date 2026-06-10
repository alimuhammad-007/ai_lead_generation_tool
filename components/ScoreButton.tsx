"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** Single-element array for per-row score buttons. */
  leadIds?: string[];
  /** Use for the bulk "Score all unscored" button. */
  scoreAllUnscored?: boolean;
  label: string;
  variant: "primary" | "ghost";
  /** Render as a compact square icon button (↺) with a tooltip. */
  iconOnly?: boolean;
  title?: string;
};

export function ScoreButton({ leadIds, scoreAllUnscored, label, variant, iconOnly, title }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = scoreAllUnscored
      ? { score_all_unscored: true }
      : leadIds?.length === 1
        ? { lead_id: leadIds[0] }
        : { lead_ids: leadIds ?? [] };

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Scoring failed");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const cls = iconOnly
    ? "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-indigo-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-40"
    : variant === "primary"
      ? "inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      : "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-40";

  return (
    <div className="relative inline-flex flex-col items-end gap-1">
      <button onClick={handleClick} disabled={loading} className={cls} title={title}>
        {loading ? (
          iconOnly ? <Spinner /> : <><Spinner />Scoring…</>
        ) : iconOnly ? (
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <>
            {variant === "primary" && <LightningIcon />}
            {label}
          </>
        )}
      </button>
      {error && (
        <span className="absolute top-full z-20 mt-1 w-52 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-600 shadow-sm">
          {error}
        </span>
      )}
    </div>
  );
}

function LightningIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L4.09 12.97H11L9.5 22.02L20.5 11.03H13.5L13 2Z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

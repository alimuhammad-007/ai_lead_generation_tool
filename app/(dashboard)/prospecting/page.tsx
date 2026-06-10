"use client";

import { useState } from "react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProspectLead {
  name:         string;
  email:        string;
  company:      string;
  title:        string;
  confidence:   number;
  type:         "personal" | "generic";
  linkedin_url: string | null;
}

interface SearchForm {
  jobTitle:  string;
  industry:  string;
  location:  string;
  limit:     number;
}

// API response shape — client adds `key` before storing in state
interface MapsApiLead {
  name:    string;
  phone:   string | null;
  website: string | null;
  address: string | null;
  rating:  number | null;
  cid:     string | null;
}

interface MapsLead extends MapsApiLead {
  key: string; // cid ?? name — stable selection identifier
}

interface MapsForm {
  businessType: string;
  location:     string;
  limit:        number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LEAD_LIMITS = [10, 25, 50];

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceCls(score: number): string {
  if (score >= 90) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (score >= 70) return "bg-blue-50    text-blue-700    ring-blue-200";
  if (score >= 50) return "bg-amber-50   text-amber-700   ring-amber-200";
  return               "bg-slate-100  text-slate-500   ring-slate-200";
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function SmSpinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProspectingPage() {

  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"people" | "maps">("people");

  // ── Shared state ─────────────────────────────────────────────────────────────
  const [error,        setError]        = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null);

  // ── People search state ───────────────────────────────────────────────────────
  const [form, setForm] = useState<SearchForm>({
    jobTitle: "",
    industry: "",
    location: "",
    limit:    10,
  });
  const [leads,         setLeads]         = useState<ProspectLead[]>([]);
  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [searching,     setSearching]     = useState(false);
  const [findingEmails, setFindingEmails] = useState(false);
  const [importing,     setImporting]     = useState(false);
  const [searched,      setSearched]      = useState(false);

  // ── Maps search state ─────────────────────────────────────────────────────────
  const [mapsForm, setMapsForm] = useState<MapsForm>({
    businessType: "",
    location:     "",
    limit:        10,
  });
  const [mapsLeads,     setMapsLeads]     = useState<MapsLead[]>([]);
  const [mapsSelected,  setMapsSelected]  = useState<Set<string>>(new Set());
  const [mapsSearching, setMapsSearching] = useState(false);
  const [mapsImporting, setMapsImporting] = useState(false);
  const [mapsSearched,  setMapsSearched]  = useState(false);

  // ── Tab switch ───────────────────────────────────────────────────────────────

  function switchTab(tab: "people" | "maps") {
    setActiveTab(tab);
    setError(null);
    setImportResult(null);
  }

  // ── People handlers ───────────────────────────────────────────────────────────

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!form.jobTitle.trim()) return;
    setSearching(true);
    setError(null);
    setImportResult(null);
    setLeads([]);
    setSelected(new Set());
    setSearched(false);
    try {
      const res = await fetch("/api/scrape/hunter", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          jobTitle:  form.jobTitle.trim(),
          industry:  form.industry.trim() || undefined,
          location:  form.location.trim() || undefined,
          limit:     form.limit,
        }),
      });
      const data = await res.json() as { leads?: ProspectLead[]; error?: string };
      if (!res.ok || data.error) { setError(data.error ?? "Search failed. Check your Serper API key."); return; }
      setLeads(data.leads ?? []);
      setSearched(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function handleFindEmails() {
    if (leads.length === 0) return;
    setFindingEmails(true);
    setError(null);
    try {
      const res = await fetch("/api/scrape/hunter", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leads }),
      });
      const data = await res.json() as { leads?: ProspectLead[]; error?: string };
      if (!res.ok || data.error) { setError(data.error ?? "Email search failed."); return; }
      if (data.leads) setLeads(data.leads);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setFindingEmails(false);
    }
  }

  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleSelectAll() {
    allSelected ? setSelected(new Set()) : setSelected(new Set(leads.map((l) => l.name)));
  }

  async function handleImport() {
    const leadsToImport = Array.from(selected)
      .map((name) => leads.find((l) => l.name === name))
      .filter((l): l is ProspectLead => !!l && !!l.name?.trim())
      .map((l) => ({
        name:         l.name.trim(),
        email:        l.email?.trim()   || "unknown@unknown.com",
        company:      l.company?.trim() || "Unknown Company",
        title:        l.title?.trim()   || "Unknown",
        linkedin_url: l.linkedin_url    || "",
      }));
    if (leadsToImport.length === 0) return;
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const res  = await fetch("/api/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leads: leadsToImport }),
      });
      const data = await res.json() as { inserted?: number; skipped?: number; error?: string };
      if (!res.ok || data.error) { setError(data.error ?? "Import failed"); return; }
      setImportResult({ inserted: data.inserted ?? 0, skipped: data.skipped ?? 0 });
      setSelected(new Set());
    } catch {
      setError("Network error — please try again.");
    } finally {
      setImporting(false);
    }
  }

  // ── Maps handlers ─────────────────────────────────────────────────────────────

  async function handleMapsSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!mapsForm.businessType.trim() || !mapsForm.location.trim()) return;
    setMapsSearching(true);
    setError(null);
    setImportResult(null);
    setMapsLeads([]);
    setMapsSelected(new Set());
    setMapsSearched(false);
    try {
      const res = await fetch("/api/scrape/maps", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          businessType: mapsForm.businessType.trim(),
          location:     mapsForm.location.trim(),
          limit:        mapsForm.limit,
        }),
      });
      const data = await res.json() as { leads?: MapsApiLead[]; error?: string };
      if (!res.ok || data.error) { setError(data.error ?? "Maps search failed. Check your Serper API key."); return; }
      setMapsLeads(
        (data.leads ?? []).map((l) => ({ ...l, key: l.cid ?? l.name }))
      );
      setMapsSearched(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setMapsSearching(false);
    }
  }

  function toggleMapsSelect(key: string) {
    setMapsSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleMapsSelectAll() {
    mapsAllSelected
      ? setMapsSelected(new Set())
      : setMapsSelected(new Set(mapsLeads.map((l) => l.key)));
  }

  async function handleMapsImport() {
    const toImport = Array.from(mapsSelected)
      .map((key) => mapsLeads.find((l) => l.key === key))
      .filter((l): l is MapsLead => !!l && !!l.name?.trim())
      .map((l) => ({
        name:         l.name.trim(),
        email:        "unknown@unknown.com",
        company:      l.name.trim(),
        title:        mapsForm.businessType.trim() || "Business",
        linkedin_url: "",
        phone:        l.phone ?? undefined,
      }));
    if (toImport.length === 0) return;
    setMapsImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const res  = await fetch("/api/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ leads: toImport }),
      });
      const data = await res.json() as { inserted?: number; skipped?: number; error?: string };
      if (!res.ok || data.error) { setError(data.error ?? "Import failed"); return; }
      setImportResult({ inserted: data.inserted ?? 0, skipped: data.skipped ?? 0 });
      setMapsSelected(new Set());
    } catch {
      setError("Network error — please try again.");
    } finally {
      setMapsImporting(false);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const allSelected     = leads.length > 0 && selected.size === leads.length;
  const someSelected    = selected.size > 0;
  const missingEmails   = leads.filter((l) => !l.email).length;
  const hasNoEmailLeads = missingEmails > 0;

  const mapsAllSelected  = mapsLeads.length > 0 && mapsSelected.size === mapsLeads.length;
  const mapsSomeSelected = mapsSelected.size > 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen p-6 lg:p-8">

      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Find Leads</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Search for leads using Google Search or Google Maps
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="mb-6 flex gap-0.5 border-b border-slate-200">
        {(["people", "maps"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={[
              "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
            ].join(" ")}
          >
            {tab === "people" ? (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                People Search
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Maps Search
              </>
            )}
          </button>
        ))}
      </div>

      {/* ── People Search form ── */}
      {activeTab === "people" && (
        <div className="mb-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <form onSubmit={handleSearch}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Job Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.jobTitle}
                  onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
                  placeholder="e.g. CEO, Marketing Director"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Industry
                  <span className="ml-1.5 font-normal normal-case text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.industry}
                  onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))}
                  placeholder="e.g. SaaS, Healthcare, Finance"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location
                  <span className="ml-1.5 font-normal normal-case text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. New York, London, Remote"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Number of Leads
                </label>
                <select
                  value={form.limit}
                  onChange={(e) => setForm((p) => ({ ...p, limit: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  {LEAD_LIMITS.map((n) => (
                    <option key={n} value={n}>{n} leads</option>
                  ))}
                </select>
              </div>

            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={searching || !form.jobTitle.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searching ? (
                  <><Spinner />Searching Google for prospects...</>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                    </svg>
                    Search with Google AI
                  </>
                )}
              </button>
              {searched && <span className="text-xs text-slate-400">Powered by Serper + Google</span>}
            </div>
          </form>
        </div>
      )}

      {/* ── Maps Search form ── */}
      {activeTab === "maps" && (
        <div className="mb-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <form onSubmit={handleMapsSearch}>
            <div className="grid gap-4 sm:grid-cols-3">

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Business Type <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={mapsForm.businessType}
                  onChange={(e) => setMapsForm((p) => ({ ...p, businessType: e.target.value }))}
                  placeholder="e.g. dentist, real estate agent"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={mapsForm.location}
                  onChange={(e) => setMapsForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. New York, London"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Number of Results
                </label>
                <select
                  value={mapsForm.limit}
                  onChange={(e) => setMapsForm((p) => ({ ...p, limit: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  {LEAD_LIMITS.map((n) => (
                    <option key={n} value={n}>{n} results</option>
                  ))}
                </select>
              </div>

            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={mapsSearching || !mapsForm.businessType.trim() || !mapsForm.location.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mapsSearching ? (
                  <><Spinner />Searching Google Maps...</>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Search Google Maps
                  </>
                )}
              </button>
              {mapsSearched && <span className="text-xs text-slate-400">Powered by Serper + Google Maps</span>}
            </div>
          </form>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Import success banner ── */}
      {importResult && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>
            <strong>{importResult.inserted}</strong> lead{importResult.inserted !== 1 ? "s" : ""} imported
            {importResult.skipped > 0 && ` · ${importResult.skipped} already existed`}
          </span>
          <Link
            href="/leads"
            className="ml-4 flex-shrink-0 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            View Leads →
          </Link>
        </div>
      )}

      {/* ── People: empty state ── */}
      {activeTab === "people" && searched && leads.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 py-20 text-center">
          <svg className="mx-auto mb-4 h-12 w-12 text-slate-200" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <p className="text-sm font-medium text-slate-500">No leads found</p>
          <p className="mt-1 text-xs text-slate-400">
            Try different keywords, a broader industry, or remove the location filter.
          </p>
        </div>
      )}

      {/* ── Maps: empty state ── */}
      {activeTab === "maps" && mapsSearched && mapsLeads.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 py-20 text-center">
          <svg className="mx-auto mb-4 h-12 w-12 text-slate-200" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm font-medium text-slate-500">No places found</p>
          <p className="mt-1 text-xs text-slate-400">
            Try a different business type or a broader location.
          </p>
        </div>
      )}

      {/* ── People results ── */}
      {activeTab === "people" && leads.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">

          {/* Header bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {leads.length} lead{leads.length !== 1 ? "s" : ""} found
              </h2>
              <button
                onClick={toggleSelectAll}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
              {someSelected && (
                <span className="text-xs text-slate-400">{selected.size} selected</span>
              )}
              {hasNoEmailLeads && !findingEmails && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 ring-1 ring-amber-200">
                  {missingEmails} missing email
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasNoEmailLeads && (
                <button
                  onClick={handleFindEmails}
                  disabled={findingEmails || searching}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {findingEmails ? (
                    <><SmSpinner />Finding emails...</>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Find Emails
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleImport}
                disabled={!someSelected || importing}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {importing ? (
                  <><SmSpinner />Importing...</>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V10" />
                    </svg>
                    {someSelected ? `Import ${selected.size} Selected` : "Import Selected"}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-12 px-5 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  {["Name", "Email", "Job Title", "Company"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leads.map((lead) => {
                  const isSelected = selected.has(lead.name);
                  const initials   = lead.name.split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("");
                  return (
                    <tr
                      key={lead.name}
                      onClick={() => toggleSelect(lead.name)}
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-indigo-50/60 hover:bg-indigo-50" : "hover:bg-slate-50/70"}`}
                    >
                      <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(lead.name)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${isSelected ? "bg-indigo-200 text-indigo-700" : "bg-indigo-100 text-indigo-600"}`}>
                            {initials || "?"}
                          </div>
                          <div className="min-w-0">
                            <span className="block max-w-[140px] truncate font-medium text-slate-900">{lead.name || "—"}</span>
                            {lead.linkedin_url && (
                              <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-indigo-500 hover:underline">
                                LinkedIn ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {lead.email ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-700">{lead.email}</span>
                            <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${confidenceCls(lead.confidence)}`}>
                              {lead.confidence}%
                            </span>
                            {lead.type === "generic" && (
                              <span className="flex-shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-slate-200">
                                generic
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-slate-200">
                            <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Email not found
                          </span>
                        )}
                      </td>
                      <td className="max-w-[160px] px-4 py-3.5">
                        <span className="block truncate text-slate-600">{lead.title || "—"}</span>
                      </td>
                      <td className="max-w-[140px] px-4 py-3.5">
                        <span className="block truncate text-slate-600">{lead.company || "—"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
            <p className="text-xs text-slate-400">
              {someSelected
                ? `${selected.size} of ${leads.length} selected`
                : `${leads.length} lead${leads.length !== 1 ? "s" : ""} · click rows or use checkboxes to select`}
            </p>
            {someSelected && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-50"
              >
                {importing ? <><SmSpinner />Importing...</> : <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V10" />
                  </svg>
                  Import {selected.size} Selected
                </>}
              </button>
            )}
          </div>

        </div>
      )}

      {/* ── Maps results ── */}
      {activeTab === "maps" && mapsLeads.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">

          {/* Header bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {mapsLeads.length} place{mapsLeads.length !== 1 ? "s" : ""} found
              </h2>
              <button
                onClick={toggleMapsSelectAll}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {mapsAllSelected ? "Deselect All" : "Select All"}
              </button>
              {mapsSomeSelected && (
                <span className="text-xs text-slate-400">{mapsSelected.size} selected</span>
              )}
            </div>

            <button
              onClick={handleMapsImport}
              disabled={!mapsSomeSelected || mapsImporting}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {mapsImporting ? (
                <><SmSpinner />Importing...</>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V10" />
                  </svg>
                  {mapsSomeSelected ? `Import ${mapsSelected.size} Selected` : "Import Selected"}
                </>
              )}
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-12 px-5 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={mapsAllSelected}
                      onChange={toggleMapsSelectAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  {["Name", "Phone", "Website", "Address", "Rating"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {mapsLeads.map((lead) => {
                  const isSelected = mapsSelected.has(lead.key);
                  const initials   = lead.name.split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("");
                  return (
                    <tr
                      key={lead.key}
                      onClick={() => toggleMapsSelect(lead.key)}
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-indigo-50/60 hover:bg-indigo-50" : "hover:bg-slate-50/70"}`}
                    >
                      {/* Checkbox */}
                      <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleMapsSelect(lead.key)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${isSelected ? "bg-indigo-200 text-indigo-700" : "bg-indigo-100 text-indigo-600"}`}>
                            {initials || "?"}
                          </div>
                          <span className="block max-w-[160px] truncate font-medium text-slate-900">
                            {lead.name || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {lead.phone ? (
                          <a
                            href={`tel:${lead.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-xs text-slate-700 hover:text-indigo-600"
                          >
                            {lead.phone}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Website */}
                      <td className="max-w-[160px] px-4 py-3.5">
                        {lead.website ? (
                          <a
                            href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="block truncate text-xs text-indigo-500 hover:underline"
                          >
                            {lead.website.replace(/^https?:\/\/(www\.)?/, "")}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Address */}
                      <td className="max-w-[200px] px-4 py-3.5">
                        <span className="block truncate text-xs text-slate-500" title={lead.address ?? undefined}>
                          {lead.address || "—"}
                        </span>
                      </td>

                      {/* Rating */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {lead.rating != null ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                            <svg className="h-3.5 w-3.5 fill-amber-400 text-amber-400" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {lead.rating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
            <p className="text-xs text-slate-400">
              {mapsSomeSelected
                ? `${mapsSelected.size} of ${mapsLeads.length} selected`
                : `${mapsLeads.length} place${mapsLeads.length !== 1 ? "s" : ""} · click rows or use checkboxes to select`}
            </p>
            {mapsSomeSelected && (
              <button
                onClick={handleMapsImport}
                disabled={mapsImporting}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-50"
              >
                {mapsImporting ? <><SmSpinner />Importing...</> : <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V10" />
                  </svg>
                  Import {mapsSelected.size} Selected
                </>}
              </button>
            )}
          </div>

        </div>
      )}

    </main>
  );
}

"use client";

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CsvRow = {
  name: string;
  email: string;
  company: string;
  title: string;
  linkedin_url: string;
};

type ParsedResult = {
  rows: CsvRow[];
  missingColumns: string[];
  totalRaw: number;
};

type ImportResult = {
  inserted: number;
  skipped: number;
  error?: string;
};

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(cur.trim()); cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  };

  const lines = normalized.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

const HEADER_ALIASES: Record<string, keyof CsvRow> = {
  name: "name", "full name": "name", full_name: "name", fullname: "name",
  "contact name": "name", contact: "name",
  email: "email", "email address": "email", email_address: "email", "work email": "email",
  company: "company", "company name": "company", company_name: "company",
  organization: "company", org: "company", account: "company",
  title: "title", "job title": "title", job_title: "title",
  jobtitle: "title", position: "title", role: "title", designation: "title",
  linkedin: "linkedin_url", "linkedin url": "linkedin_url", linkedin_url: "linkedin_url",
  "linkedin profile": "linkedin_url", linkedin_profile: "linkedin_url", "profile url": "linkedin_url",
};

const REQUIRED_COLUMNS: Array<keyof CsvRow> = ["name", "email", "company", "title"];

function normalizeHeader(raw: string): keyof CsvRow | null {
  const key = raw.toLowerCase().replace(/[^a-z0-9 _]/g, "").trim();
  return HEADER_ALIASES[key] ?? null;
}

function parseLeadsFromCSV(text: string): ParsedResult {
  const { headers, rows } = parseCSVText(text);
  const colMap = new Map<keyof CsvRow, number>();
  headers.forEach((h, i) => {
    const canonical = normalizeHeader(h);
    if (canonical && !colMap.has(canonical)) colMap.set(canonical, i);
  });

  const missingColumns = REQUIRED_COLUMNS.filter((c) => !colMap.has(c));
  const dataRows: CsvRow[] = rows
    .map((row) => ({
      name:         colMap.has("name")         ? (row[colMap.get("name")!]         ?? "") : "",
      email:        colMap.has("email")        ? (row[colMap.get("email")!]        ?? "") : "",
      company:      colMap.has("company")      ? (row[colMap.get("company")!]      ?? "") : "",
      title:        colMap.has("title")        ? (row[colMap.get("title")!]        ?? "") : "",
      linkedin_url: colMap.has("linkedin_url") ? (row[colMap.get("linkedin_url")!] ?? "") : "",
    }))
    .filter((r) => r.name || r.email);

  return { rows: dataRows, missingColumns, totalRaw: rows.length };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName,   setFileName]   = useState<string | null>(null);
  const [parsed,     setParsed]     = useState<ParsedResult | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please select a .csv file");
      return;
    }
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setParsed(parseLeadsFromCSV(e.target?.result as string));
    reader.readAsText(file);
  }, []);

  const onFileChange  = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processFile(f); };
  const onDrop        = (e: DragEvent<HTMLDivElement>)      => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); };
  const onDragOver    = (e: DragEvent<HTMLDivElement>)      => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave   = ()                                  => setIsDragOver(false);

  const handleImport = async () => {
    if (!parsed || parsed.missingColumns.length > 0) return;
    const validLeads = parsed.rows.filter((r) => r.name && r.email && r.company && r.title);
    if (validLeads.length === 0) {
      setResult({ inserted: 0, skipped: 0, error: "No valid rows to import" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res  = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leads: validLeads }) });
      const data = await res.json();
      if (!res.ok) setResult({ inserted: 0, skipped: 0, error: data.error ?? "Import failed" });
      else         setResult({ inserted: data.inserted, skipped: data.skipped });
    } catch {
      setResult({ inserted: 0, skipped: 0, error: "Network error — please try again" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setParsed(null); setFileName(null); setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validRows   = parsed?.rows.filter((r) => r.name && r.email && r.company && r.title) ?? [];
  const invalidRows = (parsed?.rows.length ?? 0) - validRows.length;
  const canImport   = parsed !== null && parsed.missingColumns.length === 0 && validRows.length > 0 && !loading;

  return (
    <main className="min-h-screen p-6 lg:p-8">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Import Leads</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Upload a CSV file to bulk-add leads. Imported leads are saved as{" "}
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
            unscored
          </span>{" "}
          — run AI scoring afterwards. Max 1,000 rows.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-5">
        {/* ── Column format card ── */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-900">Expected CSV columns</p>
              <p className="mt-1 text-sm text-indigo-700">
                <span className="font-semibold">Required:</span>{" "}
                <code className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs">name</code>{" "}
                <code className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs">email</code>{" "}
                <code className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs">company</code>{" "}
                <code className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs">title</code>
              </p>
              <p className="mt-0.5 text-sm text-indigo-700">
                <span className="font-semibold">Optional:</span>{" "}
                <code className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs">linkedin_url</code>
              </p>
              <p className="mt-2 text-xs text-indigo-500">
                Common aliases are recognised — e.g. &ldquo;Full Name&rdquo;, &ldquo;Organization&rdquo;, &ldquo;Job Title&rdquo;, &ldquo;LinkedIn&rdquo;.
              </p>
            </div>
          </div>
        </div>

        {/* ── Drop zone ── */}
        {!parsed && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={[
              "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 transition-all duration-150",
              isDragOver
                ? "border-indigo-500 bg-indigo-50 shadow-inner"
                : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 shadow-sm",
            ].join(" ")}
          >
            <div className={[
              "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors",
              isDragOver ? "bg-indigo-100" : "bg-slate-100",
            ].join(" ")}>
              <svg
                className={`h-8 w-8 transition-colors ${isDragOver ? "text-indigo-600" : "text-slate-400"}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className={`text-sm font-semibold transition-colors ${isDragOver ? "text-indigo-700" : "text-slate-700"}`}>
              {isDragOver ? "Drop your CSV file here" : "Drag & drop a CSV file"}
            </p>
            <p className="mt-1 text-xs text-slate-400">or click to browse your computer</p>
            <p className="mt-3 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
              .csv files only
            </p>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
          </div>
        )}

        {/* ── Post-parse view ── */}
        {parsed && (
          <>
            {/* File info bar */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                  <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{fileName}</p>
                  <p className="text-xs text-slate-500">
                    {parsed.totalRaw} raw rows &middot;{" "}
                    <span className="text-emerald-600 font-medium">{validRows.length} valid</span>
                    {invalidRows > 0 && (
                      <> &middot; <span className="text-amber-600 font-medium">{invalidRows} with missing fields</span></>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={reset}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
              >
                Change file
              </button>
            </div>

            {/* Missing columns warning */}
            {parsed.missingColumns.length > 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <div className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-rose-800">Missing required columns</p>
                    <p className="mt-1 text-sm text-rose-700">
                      Not found:{" "}
                      {parsed.missingColumns.map((c, i) => (
                        <span key={c}>
                          <code className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-mono">{c}</code>
                          {i < parsed.missingColumns.length - 1 && " "}
                        </span>
                      ))}
                    </p>
                    <p className="mt-1.5 text-xs text-rose-500">
                      Rename your CSV headers to match and re-upload.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Preview table */}
            {parsed.rows.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                  <p className="text-sm font-semibold text-slate-900">Preview</p>
                  <p className="text-xs text-slate-400">
                    Showing first {Math.min(parsed.rows.length, 10)} of {parsed.rows.length} rows
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-50 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {["#", "Name", "Email", "Company", "Title", "LinkedIn"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {parsed.rows.slice(0, 10).map((row, i) => {
                        const incomplete = !row.name || !row.email || !row.company || !row.title;
                        return (
                          <tr key={i} className={incomplete ? "bg-amber-50/60" : "hover:bg-slate-50/60"}>
                            <td className="px-4 py-2.5 text-xs text-slate-400">{i + 1}</td>
                            <CsvCell value={row.name}         required />
                            <CsvCell value={row.email}        required />
                            <CsvCell value={row.company}      required />
                            <CsvCell value={row.title}        required />
                            <CsvCell value={row.linkedin_url}          />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {parsed.rows.length > 10 && (
                  <div className="border-t border-slate-50 px-5 py-2 text-right">
                    <p className="text-xs text-slate-400">+{parsed.rows.length - 10} more rows not shown</p>
                  </div>
                )}
              </div>
            )}

            {/* Import result */}
            {result && (
              <div className={[
                "rounded-2xl border p-5",
                result.error
                  ? "border-rose-200 bg-rose-50"
                  : "border-emerald-200 bg-emerald-50",
              ].join(" ")}>
                {result.error ? (
                  <div className="flex items-center gap-3">
                    <svg className="h-5 w-5 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-rose-700"><span className="font-semibold">Error:</span> {result.error}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <svg className="h-5 w-5 flex-shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-emerald-800">
                      <span className="font-semibold">Import complete.</span>{" "}
                      {result.inserted} lead{result.inserted !== 1 ? "s" : ""} added.
                      {result.skipped > 0 && (
                        <span className="text-emerald-600"> {result.skipped} duplicate emails skipped.</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{validRows.length}</span>{" "}
                lead{validRows.length !== 1 ? "s" : ""} ready to import
              </p>
              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-all hover:border-slate-300 hover:shadow-sm"
                >
                  Start over
                </button>
                <button
                  onClick={handleImport}
                  disabled={!canImport}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Spinner /> Importing…
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Import {validRows.length} leads
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function CsvCell({ value, required = false }: { value: string; required?: boolean }) {
  const empty = !value;
  return (
    <td className={`px-4 py-2.5 text-sm ${empty && required ? "italic text-rose-400" : "text-slate-700"}`}>
      {empty ? (required ? "missing" : <span className="text-slate-300">—</span>) : value}
    </td>
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

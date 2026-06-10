"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { CLIENT_CONFIG } from "@/lib/config";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconOverview() {
  return (
    <svg className="h-[18px] w-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconProspecting() {
  return (
    <svg className="h-[18px] w-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="6"  strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round" />
      <line x1="2"  y1="12" x2="6"  y2="12" strokeLinecap="round" />
      <line x1="18" y1="12" x2="22" y2="12" strokeLinecap="round" />
    </svg>
  );
}
function IconLeads() {
  return (
    <svg className="h-[18px] w-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function IconImport() {
  return (
    <svg className="h-[18px] w-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
    </svg>
  );
}
function IconOutreach() {
  return (
    <svg className="h-[18px] w-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function IconSignOut() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV_MAIN = [
  { href: "/",            label: "Overview",   icon: <IconOverview />,    exact: true  },
  { href: "/prospecting", label: "Find Leads", icon: <IconProspecting />, exact: false },
  { href: "/leads",       label: "Leads",      icon: <IconLeads />,       exact: false },
  { href: "/import",      label: "Import",     icon: <IconImport />,      exact: false },
  { href: "/outreach",    label: "Outreach",   icon: <IconOutreach />,    exact: false },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string, exact: boolean) {
    return exact
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");
  }

  function navLinkCls(href: string, exact: boolean) {
    const active = isActive(href, exact);
    return [
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
      active
        ? "text-white shadow-sm"
        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
    ].join(" ");
  }

  function navLinkStyle(href: string, exact: boolean): React.CSSProperties | undefined {
    return isActive(href, exact)
      ? { backgroundColor: CLIENT_CONFIG.primaryColor }
      : undefined;
  }

  const navContent = (
    <div className="flex h-full flex-col" style={{ backgroundColor: "#0f172a" }}>
      {/* ── Logo ── */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-base font-black text-white shadow-lg"
          style={{ backgroundColor: CLIENT_CONFIG.primaryColor }}
        >
          {CLIENT_CONFIG.logoLetter}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-white">
            {CLIENT_CONFIG.companyName}
          </p>
          <p className="text-[10px] leading-tight text-slate-500">
            {CLIENT_CONFIG.companyTagline}
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto flex-shrink-0 rounded-lg p-1 text-slate-500 hover:text-slate-300 lg:hidden"
          aria-label="Close menu"
        >
          <IconClose />
        </button>
      </div>

      {/* ── Primary nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          Main
        </p>
        <ul className="space-y-0.5">
          {NAV_MAIN.map((item) => (
            <li key={item.href + item.label}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className={navLinkCls(item.href, item.exact)}
                style={navLinkStyle(item.href, item.exact)}
              >
                {item.icon}
                {item.label}
                {isActive(item.href, item.exact) && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/50" />
                )}
              </Link>
            </li>
          ))}
        </ul>

        {/* ── Tools ── */}
        <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          Tools
        </p>
        <ul className="space-y-0.5">
          <li>
            <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-500">
              <span
                className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded text-[9px] font-black text-white"
                style={{ backgroundColor: "#0A66C2" }}
              >
                in
              </span>
              LinkedIn Messages
              <span className="ml-auto rounded-full bg-indigo-950 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-400">
                AI
              </span>
            </div>
          </li>
        </ul>
      </nav>

      {/* ── Sign out ── */}
      <div className="border-t border-slate-800 p-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
        >
          <IconSignOut />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar ── */}
      <header
        className="fixed inset-x-0 top-0 z-20 flex h-14 items-center border-b border-slate-800 px-4 lg:hidden"
        style={{ backgroundColor: "#0f172a" }}
      >
        <button
          onClick={() => setOpen(true)}
          className="p-1 text-slate-400 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <IconMenu />
        </button>
        <div className="ml-3 flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-white"
            style={{ backgroundColor: CLIENT_CONFIG.primaryColor }}
          >
            {CLIENT_CONFIG.logoLetter}
          </div>
          <span className="text-sm font-semibold text-white">
            {CLIENT_CONFIG.companyName}
          </span>
        </div>
      </header>

      {/* ── Mobile overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar (drawer on mobile / sticky on desktop) ── */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 w-64 flex-col",
          "transition-transform duration-200 ease-in-out",
          "lg:sticky lg:top-0 lg:flex lg:h-screen lg:translate-x-0",
          open ? "flex translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {navContent}
      </aside>
    </>
  );
}

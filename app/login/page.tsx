"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { CLIENT_CONFIG } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // router.refresh() forces server components to re-render with the new session,
    // which lets the middleware see the updated auth cookie.
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gray-950 p-4">
      {/* Subtle radial gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(120,119,198,0.15),transparent)]"
      />

      <div className="relative w-full max-w-sm">
        {/* Logo mark + headline */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full text-lg font-black text-white shadow-lg"
            style={{ backgroundColor: CLIENT_CONFIG.primaryColor }}
          >
            {CLIENT_CONFIG.logoLetter}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
          <p className="mt-1.5 text-sm text-gray-400">
            Sign in to your {CLIENT_CONFIG.companyName} account
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-8 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <Field label="Email address">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                className={inputCls}
              />
            </Field>

            {/* Password */}
            <Field
              label="Password"
              action={
                <a
                  href="#"
                  className="text-[11px] text-gray-500 transition-colors hover:text-gray-300"
                >
                  Forgot password?
                </a>
              }
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className={inputCls}
              />
            </Field>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3">
                <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3.25a.75.75 0 01-1.5 0V5zm.75 6.5a.875.875 0 110-1.75.875.875 0 010 1.75z" />
                </svg>
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-800" />
            <span className="text-[11px] text-gray-600">or</span>
            <div className="h-px flex-1 bg-gray-800" />
          </div>

          <p className="mt-5 text-center text-[13px] text-gray-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-gray-300 transition-colors hover:text-white"
            >
              Create one free
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-gray-700">
          © {new Date().getFullYear()} {CLIENT_CONFIG.companyName} &middot; {CLIENT_CONFIG.companyTagline}
        </p>
      </div>
    </div>
  );
}

// ── Shared atoms ──────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-700 autofill:bg-gray-800";

function Field({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium text-gray-300">{label}</label>
        {action}
      </div>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3 3 3H4z" />
    </svg>
  );
}

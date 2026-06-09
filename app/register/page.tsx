"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { CLIENT_CONFIG } from "@/lib/config";

type Step = "form" | "check-email";

export default function RegisterPage() {
  const [step,            setStep]            = useState<Step>("form");
  const [fullName,        setFullName]        = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error,           setError]           = useState<string | null>(null);
  const [loading,         setLoading]         = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // If Supabase immediately confirms the session (email confirmation disabled),
    // the user object will be non-null. Otherwise, they need to confirm via email.
    if (data.session) {
      // Already logged in — hard-navigate so middleware sees the new session cookie
      window.location.href = "/";
    } else {
      setStep("check-email");
    }
  }

  if (step === "check-email") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gray-950 p-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(120,119,198,0.15),transparent)]"
        />
        <div className="relative w-full max-w-sm text-center">
          {/* Success icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-900/40 ring-1 ring-green-800">
            <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Check your inbox</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">
            We sent a confirmation link to{" "}
            <span className="font-medium text-gray-200">{email}</span>.
            <br />
            Click the link to activate your account.
          </p>
          <p className="mt-6 text-xs text-gray-600">
            Didn&apos;t receive it? Check your spam folder, or{" "}
            <button
              onClick={() => setStep("form")}
              className="text-gray-400 underline underline-offset-2 hover:text-white transition-colors"
            >
              try again
            </button>
            .
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-300 transition-colors hover:text-white"
            >
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gray-950 p-4">
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Create your account</h1>
          <p className="mt-1.5 text-sm text-gray-400">
            Start generating leads with AI today
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-8 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Full name */}
            <Field label="Full name">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoComplete="name"
                className={inputCls}
              />
            </Field>

            {/* Email */}
            <Field label="Work email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                required
                autoComplete="email"
                className={inputCls}
              />
            </Field>

            {/* Password */}
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                className={inputCls}
              />
            </Field>

            {/* Confirm password */}
            <Field label="Confirm password">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                autoComplete="new-password"
                className={`${inputCls} ${
                  confirmPassword && confirmPassword !== password
                    ? "border-red-800 focus:border-red-700 focus:ring-red-900"
                    : ""
                }`}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="mt-1 text-[11px] text-red-400">Passwords do not match</p>
              )}
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
              disabled={loading || (!!confirmPassword && confirmPassword !== password)}
              className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> Creating account…
                </span>
              ) : (
                "Create Account"
              )}
            </button>

            <p className="text-center text-[11px] leading-relaxed text-gray-600">
              By creating an account you agree to our{" "}
              <a href="#" className="text-gray-500 underline underline-offset-2 hover:text-gray-300">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-gray-500 underline underline-offset-2 hover:text-gray-300">
                Privacy Policy
              </a>
              .
            </p>
          </form>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-800" />
            <span className="text-[11px] text-gray-600">already have an account?</span>
            <div className="h-px flex-1 bg-gray-800" />
          </div>

          <div className="mt-4 text-center">
            <Link
              href="/login"
              className="text-[13px] font-medium text-gray-300 transition-colors hover:text-white"
            >
              Sign in instead
            </Link>
          </div>
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
  "w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-700";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-300">{label}</label>
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

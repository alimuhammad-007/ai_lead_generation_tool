import Link from "next/link";

export const metadata = {
  title: "Apex Lead Gen — Find, Score & Close More Leads with AI",
  description:
    "AI-powered lead generation that finds, scores, and reaches out to your ideal customers. One-time payment, full source code, no monthly fees.",
};

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon({ cls = "h-5 w-5" }: { cls?: string }) {
  return (
    <svg className={cls} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const PAIN_POINTS = [
  {
    icon: "⏳",
    title: "Spending hours manually finding leads",
    desc: "Scrolling LinkedIn, copying emails into spreadsheets, repeating the same search every week.",
  },
  {
    icon: "🎲",
    title: "Guessing which leads are worth your time",
    desc: "No system to prioritize. You reach out to everyone and convert almost no one.",
  },
  {
    icon: "📋",
    title: "Writing the same cold emails over and over",
    desc: "Copy-pasting templates, tweaking names, sending one by one. Exhausting.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Find Leads",
    desc: "Search by job title, industry, and location. Google-powered AI surfaces real decision-makers in seconds.",
    color: "from-indigo-500 to-indigo-600",
  },
  {
    num: "02",
    title: "AI Scoring",
    desc: "Every lead is automatically scored Hot, Warm, or Cold so you know exactly where to focus.",
    color: "from-violet-500 to-violet-600",
  },
  {
    num: "03",
    title: "Send Emails",
    desc: "Groq AI writes hyper-personalized outreach emails and sends them automatically via your SMTP.",
    color: "from-fuchsia-500 to-fuchsia-600",
  },
  {
    num: "04",
    title: "Track Results",
    desc: "See opens, replies, and conversions in a real-time dashboard. Know what's working at a glance.",
    color: "from-pink-500 to-pink-600",
  },
];

const FEATURES = [
  {
    emoji: "🔍",
    title: "AI Lead Discovery",
    desc: "Google-powered Serper search finds real contacts by job title, industry, and location. Up to 25 leads per search.",
  },
  {
    emoji: "🌡️",
    title: "Smart AI Scoring",
    desc: "Llama 3.3 70B classifies every lead as Hot, Warm, or Cold with a written reason you can act on.",
  },
  {
    emoji: "✉️",
    title: "Personalized Outreach",
    desc: "Groq AI crafts a unique email for each lead using their name, company, and role. No more copy-paste.",
  },
  {
    emoji: "📨",
    title: "Bulk Email Sending",
    desc: "Select hundreds of leads and send personalized emails in one click via your own SMTP provider.",
  },
  {
    emoji: "👁️",
    title: "Email Tracking",
    desc: "Invisible tracking pixels record opens. Know who read your email so you can follow up at the right moment.",
  },
  {
    emoji: "📊",
    title: "Full Dashboard",
    desc: "One place to see all your leads, outreach history, open rates, and pipeline health. Built on Supabase.",
  },
];

const INCLUDES = [
  "Full Next.js + Supabase source code",
  "AI lead finder (Google / Serper.dev)",
  "AI lead scoring (Groq / Llama 3.3)",
  "Personalized email generation",
  "Bulk email outreach",
  "Email open tracking",
  "Dashboard & analytics",
  "Step-by-step setup guide",
  "Lifetime updates included",
];

const FAQS = [
  {
    q: "What do I get exactly?",
    a: "You get the complete Next.js 14 source code for Apex Lead Gen — every file, every component, every API route. Deploy it on your own server (Vercel is free) and own it forever.",
  },
  {
    q: "Do I need technical knowledge to set it up?",
    a: "Basic comfort with Next.js and environment variables is enough. The setup guide walks you through every step: Supabase project, API keys, SMTP config, and deploying to Vercel in under 30 minutes.",
  },
  {
    q: "Is there a monthly fee?",
    a: "No. $499 once, yours forever. The APIs you'll use (Serper, Groq, Supabase free tier, Resend/Gmail SMTP) all have generous free tiers that cover most use cases at zero extra cost.",
  },
  {
    q: "What APIs do I need?",
    a: "Serper.dev (Google search — free tier available), Groq AI (free tier, ultra fast), Supabase (free tier covers most projects), and any SMTP provider like Gmail, Resend, or Mailgun.",
  },
  {
    q: "Can I white-label this for clients?",
    a: "Yes. You own the source code. Rebrand it, resell it to clients, charge a monthly fee — it's yours to do with as you please. No royalties, no restrictions.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans antialiased">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f172a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-base font-bold tracking-tight text-white">Apex Lead Gen</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 md:flex">
            <a href="#how-it-works" className="transition hover:text-white">How it works</a>
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white sm:block"
            >
              Log in
            </Link>
            <a
              href="#pricing"
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400"
            >
              Get Access — $499
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#0f172a] pb-24 pt-20 sm:pb-32 sm:pt-28">
        {/* background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-violet-600/15 blur-[120px]" />
          <div className="absolute bottom-0 left-1/2 h-[300px] w-[800px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[100px]" />
        </div>

        {/* grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          {/* pill badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
            </span>
            AI-Powered Lead Generation
          </div>

          <h1 className="mb-6 text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Find Your Next{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              100 Customers
            </span>{" "}
            on Autopilot
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            AI-powered lead generation that finds, scores, and reaches out to your ideal customers — all in one tool. One-time payment. Your server. Your data.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#pricing"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-indigo-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-indigo-500/30 transition-all hover:bg-indigo-400 hover:shadow-indigo-500/50"
            >
              <span>Get Apex Lead Gen — $499</span>
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/10"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Watch Demo
            </a>
          </div>

          {/* Trust badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-slate-400">
            {["One-time payment", "No monthly fees", "Full source code"].map((t) => (
              <span key={t} className="flex items-center gap-2">
                <CheckIcon cls="h-4 w-4 text-emerald-400" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="relative mx-auto mt-16 max-w-5xl px-6">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-800/50 shadow-2xl shadow-black/50 backdrop-blur-sm">
            {/* fake browser chrome */}
            <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900/80 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
              <div className="mx-4 flex-1 rounded-md bg-slate-700/50 px-3 py-1 text-xs text-slate-400">
                app.apexleadgen.com/leads
              </div>
            </div>
            {/* fake dashboard */}
            <div className="grid grid-cols-4 gap-3 p-6">
              {[
                { label: "Hot Leads",  value: "47",  cls: "text-rose-400"    },
                { label: "Warm Leads", value: "128", cls: "text-amber-400"   },
                { label: "Emails Sent",value: "312", cls: "text-indigo-400"  },
                { label: "Open Rate",  value: "34%", cls: "text-emerald-400" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="rounded-xl border border-white/5 bg-slate-700/40 p-4">
                  <p className="mb-1 text-xs font-medium text-slate-400">{label}</p>
                  <p className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-white/5 px-6 pb-6">
              <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900/60">
                <div className="grid grid-cols-5 border-b border-white/5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span className="col-span-2">Name</span>
                  <span>Company</span>
                  <span>Score</span>
                  <span>Status</span>
                </div>
                {[
                  { name: "Sarah Johnson",  co: "TechCorp",    score: 92, status: "hot",  sc: "bg-rose-500/20 text-rose-300"    },
                  { name: "Michael Chen",   co: "GrowthLabs",  score: 78, status: "warm", sc: "bg-amber-500/20 text-amber-300"  },
                  { name: "Emily Rivera",   co: "ScaleUp Inc", score: 65, status: "warm", sc: "bg-amber-500/20 text-amber-300"  },
                  { name: "David Williams", co: "LaunchBase",  score: 41, status: "cold", sc: "bg-blue-500/20 text-blue-300"   },
                ].map((r) => (
                  <div key={r.name} className="grid grid-cols-5 items-center border-b border-white/5 px-4 py-3 last:border-0">
                    <div className="col-span-2 flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-300">
                        {r.name.slice(0, 2)}
                      </div>
                      <span className="text-sm font-medium text-slate-200">{r.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">{r.co}</span>
                    <span className="text-sm font-bold text-slate-200">{r.score}</span>
                    <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${r.sc}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">The Problem</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Are you tired of…
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {PAIN_POINTS.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-2xl border border-rose-100 bg-white p-7 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-2xl">
                  {icon}
                </div>
                <div className="mb-1 flex items-start gap-2">
                  <XIcon />
                  <h3 className="font-bold leading-snug text-slate-900">{title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-center text-lg font-semibold text-slate-700">
            There&apos;s a better way. <span className="text-indigo-600">Let AI do the work.</span>
          </p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">How It Works</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              From zero to booked meetings in 4 steps
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
              Apex Lead Gen automates the entire top-of-funnel so you can spend your time closing, not prospecting.
            </p>
          </div>

          <div className="relative grid gap-8 sm:grid-cols-2">
            {/* connector line (desktop) */}
            <div className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 border-l border-dashed border-slate-200 sm:block" />

            {STEPS.map(({ num, title, desc, color }, i) => (
              <div
                key={num}
                className={`relative flex gap-5 rounded-2xl border border-slate-100 bg-white p-7 shadow-sm transition hover:shadow-md ${i % 2 === 1 ? "sm:mt-10" : ""}`}
              >
                <div className={`mt-0.5 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                  <span className="text-lg font-black text-white">{num}</span>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-bold text-slate-900">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">Features</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Everything you need to fill your pipeline
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
              One tool replaces your entire prospecting stack — lead finder, CRM, email tool, and analytics.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ emoji, title, desc }) => (
              <div
                key={title}
                className="group rounded-2xl border border-slate-100 bg-white p-7 shadow-sm transition hover:border-indigo-100 hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-2xl transition group-hover:bg-indigo-100">
                  {emoji}
                </div>
                <h3 className="mb-2 font-bold text-slate-900">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <section className="bg-indigo-600 py-14">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="mb-2 text-xl font-bold text-white sm:text-2xl">
            Stop renting software. Start owning your growth engine.
          </p>
          <p className="text-indigo-200">
            One payment. Full code. Deploy in 30 minutes.
          </p>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-lg px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">Pricing</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Simple, honest pricing
            </h2>
            <p className="mt-3 text-slate-500">No tiers. No seats. No surprises.</p>
          </div>

          <div className="relative overflow-hidden rounded-3xl border-2 border-indigo-500 bg-white shadow-2xl shadow-indigo-100">
            {/* top badge */}
            <div className="bg-indigo-500 py-2 text-center text-xs font-bold uppercase tracking-widest text-white">
              Most Popular — One-Time Deal
            </div>

            <div className="p-8 sm:p-10">
              {/* price */}
              <div className="mb-8 text-center">
                <div className="mb-1 flex items-start justify-center gap-1">
                  <span className="mt-3 text-2xl font-bold text-slate-400">$</span>
                  <span className="text-7xl font-black tracking-tight text-slate-900">499</span>
                </div>
                <p className="text-sm font-medium text-slate-500">one-time · no monthly fees</p>
              </div>

              {/* includes list */}
              <ul className="mb-8 space-y-3">
                {INCLUDES.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-700">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckIcon cls="h-3 w-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a
                href="#"
                className="block w-full rounded-xl bg-indigo-600 py-4 text-center text-base font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500 hover:shadow-indigo-500/50"
              >
                Get Instant Access — $499
              </a>

              <p className="mt-4 text-center text-xs text-slate-400">
                One-time payment · No subscription · Deploy on your server
              </p>

              {/* guarantee */}
              <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-2xl">🔒</span>
                <p className="text-xs text-slate-500">
                  Secure checkout. Instant access to source code after purchase.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">FAQ</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Common questions
            </h2>
          </div>

          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-2xl border border-slate-200 bg-white shadow-sm transition open:shadow-md"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
                  <span className="font-semibold text-slate-900">{q}</span>
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 transition group-open:rotate-45 group-open:border-indigo-200 group-open:bg-indigo-50 group-open:text-indigo-600">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </span>
                </summary>
                <div className="border-t border-slate-100 px-6 pb-5 pt-4 text-sm leading-relaxed text-slate-600">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden bg-[#0f172a] py-20 sm:py-28">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 top-0 h-[400px] w-[400px] rounded-full bg-indigo-600/20 blur-[100px]" />
          <div className="absolute -right-20 bottom-0 h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Ready to automate your lead gen?
          </h2>
          <p className="mb-10 text-lg text-slate-400">
            Join the founders, agencies, and sales teams using Apex Lead Gen to fill their pipeline on autopilot.
          </p>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-10 py-4 text-base font-bold text-white shadow-xl shadow-indigo-500/30 transition hover:bg-indigo-400"
          >
            Get Apex Lead Gen — $499
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
          <p className="mt-4 text-sm text-slate-500">One-time payment · Full source code · No subscriptions</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500">
                <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm font-bold text-slate-900">Apex Lead Gen</span>
            </div>
            <p className="text-xs text-slate-400">
              © 2026 Apex Lead Gen · Built with Next.js + Supabase + Groq AI
            </p>
            <Link
              href="/login"
              className="text-xs font-medium text-slate-500 transition hover:text-indigo-600"
            >
              Log in →
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

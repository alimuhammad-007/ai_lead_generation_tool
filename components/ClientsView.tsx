"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient, type CreateClientInput } from "@/app/actions/clients";
import type { Client, ClientPlan, SubscriptionStatus } from "@/types/database";

export type ClientWithCount = Client & { lead_count: number };

// ── Plan config ───────────────────────────────────────────────────────────────

const PLAN_LABEL: Record<ClientPlan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
};

const PLAN_STYLE: Record<ClientPlan, string> = {
  free:    "bg-gray-100 text-gray-600",
  starter: "bg-blue-100 text-blue-700",
  pro:     "bg-purple-100 text-purple-700",
};

const STATUS_STYLE: Record<SubscriptionStatus, string> = {
  active:    "bg-green-100 text-green-700",
  trialing:  "bg-amber-100 text-amber-700",
  past_due:  "bg-red-100 text-red-700",
  canceled:  "bg-gray-100 text-gray-500",
};

// ── Main component ────────────────────────────────────────────────────────────

export function ClientsView({ initialClients }: { initialClients: ClientWithCount[] }) {
  const [clients, setClients] = useState(initialClients);
  const [modalOpen, setModalOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);

  const totalPaid = clients.filter((c) => c.plan !== "free").length;
  const mrr = clients.reduce((sum, c) => {
    if (c.subscription_status !== "active") return sum;
    if (c.plan === "starter") return sum + 299;
    if (c.plan === "pro") return sum + 499;
    return sum;
  }, 0);

  async function handleUpgrade(clientId: string, plan: "starter" | "pro") {
    setBillingLoading(clientId);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_checkout", client_id: clientId, plan }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Billing error");
      }
    } catch {
      alert("Network error — please try again.");
    } finally {
      setBillingLoading(null);
    }
  }

  async function handlePortal(clientId: string) {
    setBillingLoading(clientId);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal", client_id: clientId }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        alert(data.error ?? "Unable to open billing portal");
      }
    } catch {
      alert("Network error — please try again.");
    } finally {
      setBillingLoading(null);
    }
  }

  function onClientCreated(c: Client) {
    setClients((prev) => [{ ...c, lead_count: 0 }, ...prev]);
    setModalOpen(false);
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="mt-1 text-sm text-gray-500">
            {clients.length} client{clients.length !== 1 ? "s" : ""} &middot; {totalPaid} paid
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Add Client
        </button>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Clients" value={clients.length} />
        <SummaryCard label="Paid" value={totalPaid} />
        <SummaryCard label="Starter" value={clients.filter((c) => c.plan === "starter").length} />
        <SummaryCard label="Pro" value={clients.filter((c) => c.plan === "pro").length} />
      </div>

      {/* MRR banner */}
      {mrr > 0 && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-700 px-6 py-4 text-white">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Revenue</p>
          <p className="mt-1 text-3xl font-bold">${mrr.toLocaleString()}</p>
        </div>
      )}

      {/* Plans reference */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <PlanCard
          plan="Starter"
          price="$299"
          features={["Up to 500 leads", "AI scoring", "Email outreach", "CSV import"]}
          highlighted={false}
        />
        <PlanCard
          plan="Pro"
          price="$499"
          features={["Unlimited leads", "AI scoring + sequences", "Priority support", "Custom branding"]}
          highlighted
        />
      </div>

      {/* Client table */}
      {clients.length === 0 ? (
        <EmptyClients onAdd={() => setModalOpen(true)} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  {["Client", "Plan", "Status", "Leads", "Added", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    {/* Client name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                          {c.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{c.name}</p>
                          <p className="text-xs text-gray-400 truncate">{c.company}</p>
                        </div>
                      </div>
                    </td>
                    {/* Plan */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_STYLE[c.plan]}`}>
                        {PLAN_LABEL[c.plan]}
                      </span>
                    </td>
                    {/* Subscription status */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[c.subscription_status]}`}>
                        {c.subscription_status.replace("_", " ")}
                      </span>
                    </td>
                    {/* Lead count */}
                    <td className="px-5 py-4">
                      <Link
                        href={`/leads?client_id=${c.id}`}
                        className="font-semibold text-gray-900 hover:text-black underline underline-offset-2"
                      >
                        {c.lead_count}
                      </Link>
                    </td>
                    {/* Date */}
                    <td className="whitespace-nowrap px-5 py-4 text-gray-400 text-xs">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {c.plan === "free" ? (
                          <>
                            <ActionButton
                              label="Starter"
                              loading={billingLoading === c.id}
                              onClick={() => handleUpgrade(c.id, "starter")}
                            />
                            <ActionButton
                              label="Pro"
                              loading={billingLoading === c.id}
                              onClick={() => handleUpgrade(c.id, "pro")}
                              primary
                            />
                          </>
                        ) : (
                          <ActionButton
                            label="Manage billing"
                            loading={billingLoading === c.id}
                            onClick={() => handlePortal(c.id)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add client modal */}
      {modalOpen && (
        <AddClientModal
          onClose={() => setModalOpen(false)}
          onCreated={onClientCreated}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}

function PlanCard({
  plan,
  price,
  features,
  highlighted,
}: {
  plan: string;
  price: string;
  features: string[];
  highlighted: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        highlighted
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-200 bg-white text-gray-900"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${highlighted ? "text-gray-400" : "text-gray-500"}`}>
            {plan}
          </p>
          <p className="mt-1 text-2xl font-bold">{price}<span className={`ml-1 text-sm font-normal ${highlighted ? "text-gray-400" : "text-gray-500"}`}>one-time</span></p>
        </div>
        {highlighted && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Popular
          </span>
        )}
      </div>
      <ul className="mt-4 space-y-1.5">
        {features.map((f) => (
          <li key={f} className={`flex items-center gap-2 text-sm ${highlighted ? "text-gray-300" : "text-gray-600"}`}>
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActionButton({
  label,
  loading,
  onClick,
  primary = false,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        primary
          ? "bg-gray-900 text-white hover:bg-gray-700"
          : "border border-gray-200 text-gray-700 hover:bg-gray-50"
      }`}
    >
      {loading ? "…" : label}
    </button>
  );
}

function EmptyClients({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center">
      <p className="text-sm font-medium text-gray-500">No clients yet</p>
      <p className="mt-1 text-xs text-gray-400">Add your first client to start managing leads and billing.</p>
      <button
        onClick={onAdd}
        className="mt-4 rounded-xl bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
      >
        + Add Client
      </button>
    </div>
  );
}

// ── Add client modal ──────────────────────────────────────────────────────────

function AddClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: Client) => void;
}) {
  const [form, setForm] = useState<CreateClientInput>({ name: "", email: "", company: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const client = await createClient(form);
        onCreated(client);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create client");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Add Client</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {[
            { label: "Full Name",    field: "name"    as const, type: "text",  placeholder: "Jane Smith"          },
            { label: "Email",        field: "email"   as const, type: "email", placeholder: "jane@company.com"    },
            { label: "Company",      field: "company" as const, type: "text",  placeholder: "Acme Corp"           },
          ].map(({ label, field, type, placeholder }) => (
            <div key={field}>
              <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
              <input
                type={type}
                value={form[field]}
                onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                placeholder={placeholder}
                required
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
          ))}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Creating…" : "Add Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

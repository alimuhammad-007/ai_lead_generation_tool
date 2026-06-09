"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      email: form.get("email"),
      company: form.get("company"),
      title: form.get("title"),
      linkedin_url: form.get("linkedin_url") || null,
    };

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create lead");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Add New Lead</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { name: "name", label: "Full Name", required: true },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "company", label: "Company", required: true },
          { name: "title", label: "Job Title", required: true },
          { name: "linkedin_url", label: "LinkedIn URL", required: false },
        ].map((field) => (
          <div key={field.name}>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </label>
            <input
              name={field.name}
              type={field.type ?? "text"}
              required={field.required}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        ))}

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-black py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "Scoring with AI..." : "Add & Score Lead"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}

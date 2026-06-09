import { createAdminClient } from "@/lib/supabase";

export type UnscoredLeadInput = {
  user_id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  linkedin_url?: string | null;
};

export type BulkInsertResult = {
  inserted: number;
  skipped: number; // duplicates on email
};

/**
 * Bulk-inserts leads with status="unscored" and score=0.
 * Silently skips rows whose email already exists in the table.
 * Requires the `leads_email_unique` constraint (migration 002).
 */
export async function insertUnscoredLeads(
  leads: UnscoredLeadInput[]
): Promise<BulkInsertResult> {
  if (leads.length === 0) return { inserted: 0, skipped: 0 };

  const supabase = createAdminClient();
  const rows = leads.map((l) => ({
    user_id: l.user_id,
    name: l.name.trim(),
    email: l.email.trim().toLowerCase(),
    company: l.company.trim(),
    title: l.title.trim(),
    linkedin_url: l.linkedin_url?.trim() || null,
    score: 0,
    status: "unscored" as const,
  }));

  const { data, error } = await supabase
    .from("leads")
    .upsert(rows, { onConflict: "email", ignoreDuplicates: true })
    .select("id");

  if (error) throw new Error(error.message);

  const inserted = data?.length ?? 0;
  return { inserted, skipped: leads.length - inserted };
}

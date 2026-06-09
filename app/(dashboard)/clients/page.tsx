import { createAdminClient } from "@/lib/supabase";
import { ClientsView, type ClientWithCount } from "@/components/ClientsView";
import type { Client } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = createAdminClient();

  const [clientsRes, leadCountsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("client_id")
      .not("client_id", "is", null),
  ]);

  const leadCounts = new Map<string, number>();
  for (const row of leadCountsRes.data ?? []) {
    if (row.client_id) {
      leadCounts.set(row.client_id, (leadCounts.get(row.client_id) ?? 0) + 1);
    }
  }

  const clients: ClientWithCount[] = (clientsRes.data ?? []).map(
    (c: Client) => ({ ...c, lead_count: leadCounts.get(c.id) ?? 0 })
  );

  return <ClientsView initialClients={clients} />;
}

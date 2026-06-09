import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface LeadInput {
  name:          string;
  email?:        string;
  company?:      string;
  title?:        string;
  linkedin_url?: string | null;
}

const MAX_BATCH = 1000;

export async function POST(req: NextRequest) {
  // ── Auth: get the signed-in user from the session cookie ─────────────────
  const serverClient = createServerSupabaseClient();
  const { data: { user }, error: authError } = await serverClient.auth.getUser();

  console.log("[import] auth check — user:", user?.id ?? null, "authError:", authError?.message ?? null);

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated. Please sign in and try again." },
      { status: 401 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { leads: LeadInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { leads } = body;

  console.log("[import] received leads count:", leads?.length ?? 0);
  if (leads?.[0]) console.log("[import] first lead sample:", JSON.stringify(leads[0]));

  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json(
      { error: "leads[] must be a non-empty array" },
      { status: 400 }
    );
  }

  if (leads.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Maximum ${MAX_BATCH} leads per request` },
      { status: 400 }
    );
  }

  // Only name is required
  const badRows = leads.reduce<number[]>((acc, l, i) => {
    if (!l.name?.trim()) acc.push(i + 1);
    return acc;
  }, []);

  if (badRows.length > 0) {
    return NextResponse.json(
      { error: "Rows missing required field: name", bad_rows: badRows.slice(0, 20) },
      { status: 422 }
    );
  }

  // ── Insert loop — admin client bypasses RLS; user_id is set explicitly ────
  const adminClient = createAdminClient();

  let inserted = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const l of leads) {
    const row = {
      user_id:      user.id,
      name:         l.name.trim(),
      email:        l.email?.trim().toLowerCase() || null,
      company:      l.company?.trim()             || null,
      title:        l.title?.trim()               || null,
      linkedin_url: l.linkedin_url?.trim()        || null,
      score:        0,
      status:       "unscored" as const,
    };

    console.log("[import] inserting row:", JSON.stringify(row));

    const { error } = await adminClient.from("leads").insert(row);

    if (error) {
      console.error("[import] insert error — code:", error.code, "message:", error.message, "details:", error.details);
      if (error.code === "23505") {
        // Unique constraint violation — duplicate, skip silently
        skipped++;
      } else {
        errors.push(`${l.name}: ${error.message} (code: ${error.code})`);
        skipped++;
      }
    } else {
      console.log("[import] inserted:", row.name);
      inserted++;
    }
  }

  console.log("[import] done — inserted:", inserted, "skipped:", skipped, "errors:", errors.length);

  return NextResponse.json({ inserted, skipped, errors }, { status: 201 });
}

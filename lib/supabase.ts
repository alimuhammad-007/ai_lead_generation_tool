import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Browser / client components ───────────────────────────────────────────────
// Uses @supabase/ssr so session cookies are correctly synced with middleware.
// Call this inside client components — do not use at module level.
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

// Legacy singleton — kept so existing imports of `supabase` continue to work.
// For new auth-aware code, prefer createBrowserSupabaseClient().
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// ── Admin / server-side ───────────────────────────────────────────────────────
// Uses service role key — bypasses RLS entirely.
// Only call from API routes, Route Handlers, or Server Actions. Never client components.
export function createAdminClient() {
  return createClient<Database>(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Server component auth client ──────────────────────────────────────────────
// Import from lib/supabase-server.ts — kept in a separate file so that
// `next/headers` (server-only) never enters the client bundle.

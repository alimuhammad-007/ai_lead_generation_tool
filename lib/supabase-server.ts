// SERVER ONLY — do not import from client components.
// Uses next/headers which is unavailable in the browser bundle.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Auth-aware server client: reads the signed-in user's session from cookies.
// Use in Server Components, Server Actions, and Route Handlers that need
// to know who the current user is.
// Note: cookies() is synchronous in Next.js 14.
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — read-only cookies, safely ignored
          // because the middleware handles session refresh.
        }
      },
    },
  });
}

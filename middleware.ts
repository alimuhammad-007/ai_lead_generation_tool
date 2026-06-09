import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// ── Public routes — no auth required ─────────────────────────────────────────

const AUTH_ROUTES  = new Set(["/login", "/register"]);

// Any pathname starting with one of these prefixes is unconditionally public
const PUBLIC_PREFIXES = [
  "/_next/",
  "/api/outreach/track", // tracking pixel must remain publicly reachable
  "/favicon",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let static assets and the tracking pixel through without touching cookies
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // We must forward cookie mutations so the session refresh propagates
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write updated session cookies back into both request and response
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT on every request — do not use getSession()
  // here as it can return stale data from the cookie without re-validation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;
  const isAuthRoute     = AUTH_ROUTES.has(pathname);

  // Unauthenticated user on a protected route → send to /login
  if (!isAuthenticated && !isAuthRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the original destination so we can redirect back after login
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user on /login or /register → send to dashboard
  if (isAuthenticated && isAuthRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return res;
}

// Run on every route except Next.js internals and static files.
// The PUBLIC_PREFIXES guard above handles the tracking pixel.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};

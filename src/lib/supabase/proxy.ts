import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseConfig } from "@/src/auth/config";
import { safeRelativeDestination } from "@/src/auth/redirects";

const PROTECTED_PATHS = ["/prototype/a/dashboard", "/onboarding", "/profile", "/auth/update-password"] as const;

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function withRefreshCookies(source: NextResponse, target: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const config = getPublicSupabaseConfig();
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const authenticated = !error && typeof data?.claims?.sub === "string";
  if (!authenticated && isProtected(request.nextUrl.pathname)) {
    const next = safeRelativeDestination(`${request.nextUrl.pathname}${request.nextUrl.search}`);
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/auth/sign-in";
    signInUrl.search = `?next=${encodeURIComponent(next)}`;
    return withRefreshCookies(response, NextResponse.redirect(signInUrl));
  }
  return response;
}

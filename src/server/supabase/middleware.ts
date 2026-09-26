import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { readPublicSupabaseEnvironment } from "./config";
import { hasRequiredPolicyConsents } from "@/server/consent";

const PUBLIC_PATHS = new Set([
  "/terms", "/privacy", "/consent", "/login", "/signup",
  "/forgot-password", "/reset-password", "/auth/callback",
]);

function shouldCheckConsent(request: NextRequest): boolean {
  const path = request.nextUrl.pathname;
  return (request.method === "GET" || request.method === "HEAD")
    && !PUBLIC_PATHS.has(path)
    && !path.startsWith("/api/")
    && !path.startsWith("/guide/")
    && !/\.[a-z0-9]+$/i.test(path);
}

export async function refreshAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const environment = readPublicSupabaseEnvironment();
  const supabase = createServerClient(environment.url, environment.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (user && shouldCheckConsent(request) && !await hasRequiredPolicyConsents(supabase, user.id)) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/consent";
    destination.search = "";
    destination.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    const consentResponse = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => consentResponse.cookies.set(cookie));
    return consentResponse;
  }
  return response;
}

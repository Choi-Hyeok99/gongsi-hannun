import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { readPublicSupabaseEnvironment } from "./config";
import { hasRequiredPolicyConsents } from "@/server/consent";
import { isAdminUser } from "@/domain/admin-access";

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

  const { data: { user }, error } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const adminApi = path === "/api/admin" || path.startsWith("/api/admin/");
  const adminPage = path === "/admin" || path.startsWith("/admin/");
  if (adminApi || adminPage) {
    if (error || !user || !isAdminUser(user.id,process.env.ADMIN_USER_IDS)) {
      const destination = request.nextUrl.clone();
      destination.pathname = "/login";
      destination.search = "?next=%2Fadmin";
      const denied = adminApi
        ? NextResponse.json({error:"접근 권한이 없습니다."},{status:error || !user ? 401 : 403})
        : error || !user ? NextResponse.redirect(destination) : new NextResponse("페이지를 찾을 수 없습니다.",{status:404});
      denied.headers.set("Cache-Control","private, no-store, max-age=0");
      denied.headers.set("X-Robots-Tag","noindex, nofollow");
      denied.headers.set("Vary","Cookie");
      response.cookies.getAll().forEach(cookie=>denied.cookies.set(cookie));
      return denied;
    }
  }
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

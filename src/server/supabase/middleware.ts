import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { readPublicSupabaseEnvironment } from "./config";

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

  await supabase.auth.getUser();
  return response;
}

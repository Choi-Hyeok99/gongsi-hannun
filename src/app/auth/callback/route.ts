import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/domain/auth";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeRedirectPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("error", "인증 링크가 만료되었거나 올바르지 않습니다.");
  return NextResponse.redirect(loginUrl);
}

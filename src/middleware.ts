import type { NextRequest } from "next/server";
import { refreshAuthSession } from "@/server/supabase/middleware";

// Scope the new edge gate to administration. Do not alter existing public
// market pages or the email/Kakao authentication flow.
export async function middleware(request: NextRequest) {
  return refreshAuthSession(request);
}
export const config = {matcher:["/admin/:path*","/api/admin/:path*"]};

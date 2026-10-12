import "server-only";
import { cookies } from "next/headers";
import { AI_AGE_COOKIE_NAME, guestAiAccess, GUEST_AI_COOKIE_NAME, GUEST_AI_PENDING_COOKIE_NAME, readAiAgeClaim, readGuestAiClaim, readGuestAiPendingClaim } from "@/domain/guest-ai-access";
import { readServerEnvironment } from "@/server/env";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function readGuestAiAccess(receiptNumber: string) {
  const supabase = await createSupabaseServerClient();
  const {data:{user}} = await supabase.auth.getUser();
  const store = await cookies();
  const secret = readServerEnvironment().SUPABASE_SECRET_KEY;
  const claim = readGuestAiClaim(store.get(GUEST_AI_COOKIE_NAME)?.value, secret);
  return guestAiAccess(Boolean(user), receiptNumber, claim, readAiAgeClaim(store.get(AI_AGE_COOKIE_NAME)?.value, secret), readGuestAiPendingClaim(store.get(GUEST_AI_PENDING_COOKIE_NAME)?.value, secret));
}

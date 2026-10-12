"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findAiDisclosureSummaryState } from "@/data/server-ai-analysis-repository";
import { AI_AGE_COOKIE_NAME, createAiAgeClaim, createGuestAiClaim, GUEST_AI_COOKIE_MAX_AGE, GUEST_AI_COOKIE_NAME, isReceiptNumber, readAiAgeClaim, readGuestAiClaim } from "@/domain/guest-ai-access";
import { readServerEnvironment } from "@/server/env";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { GUEST_AI_PENDING_COOKIE_NAME, GUEST_AI_PENDING_MAX_AGE, createGuestAiPendingClaim, readGuestAiPendingClaim } from "@/domain/guest-ai-access";

export async function openGuestAiSummary(formData: FormData): Promise<never> {
  const receiptNumber = String(formData.get("receiptNumber") ?? "");
  if (!isReceiptNumber(receiptNumber)) redirect("/disclosures");
  const target = `/disclosures/${receiptNumber}`;
  const supabase = await createSupabaseServerClient();
  const {data:{user}} = await supabase.auth.getUser();
  const store = await cookies();
  const secret = readServerEnvironment().SUPABASE_SECRET_KEY;
  const cookieOptions = {httpOnly:true,secure:process.env.NODE_ENV === "production",sameSite:"lax" as const,path:"/",maxAge:GUEST_AI_COOKIE_MAX_AGE};
  if (!readAiAgeClaim(store.get(AI_AGE_COOKIE_NAME)?.value, secret)) {
    if (formData.get("aiAdultConfirmed") !== "on") redirect(target);
    store.set(AI_AGE_COOKIE_NAME, createAiAgeClaim(secret), cookieOptions);
  }
  if (user) redirect(`${target}#ai-summary-heading`);
  const claimed = readGuestAiClaim(store.get(GUEST_AI_COOKIE_NAME)?.value, secret);
  if (claimed && claimed !== receiptNumber) redirect(`/login?next=${encodeURIComponent(target)}&message=${encodeURIComponent("다른 AI 요약은 로그인 후 무료로 확인할 수 있습니다.")}`);
  const pending = readGuestAiPendingClaim(store.get(GUEST_AI_PENDING_COOKIE_NAME)?.value, secret);
  if (!claimed && pending && pending !== receiptNumber) redirect(`/disclosures/${pending}#ai-summary-heading`);
  if (!claimed) {
    const summary = await findAiDisclosureSummaryState(receiptNumber).catch(() => null);
    if (summary?.status !== "READY") {
      store.set(GUEST_AI_PENDING_COOKIE_NAME, createGuestAiPendingClaim(receiptNumber, secret), {...cookieOptions,maxAge:GUEST_AI_PENDING_MAX_AGE});
      redirect(target);
    }
    store.set(GUEST_AI_COOKIE_NAME, createGuestAiClaim(receiptNumber, secret), cookieOptions);
    store.set(GUEST_AI_PENDING_COOKIE_NAME, "", {...cookieOptions,maxAge:0});
  }
  redirect(`${target}#ai-summary-heading`);
}

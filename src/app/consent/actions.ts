"use server";

import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/domain/auth";
import { parseRequiredPolicyAgreement } from "@/domain/consent";
import { saveRequiredPolicyConsents } from "@/server/consent";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function acceptRequiredPolicies(formData: FormData) {
  const next = safeRedirectPath(formData.get("next")?.toString() ?? null);
  const parsed = parseRequiredPolicyAgreement(formData);
  if (!parsed.success) {
    redirect(`/consent?next=${encodeURIComponent(next)}&error=${encodeURIComponent(parsed.message)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/consent?next=${encodeURIComponent(next)}`)}`);
  }

  if (!await saveRequiredPolicyConsents(supabase, user.id)) {
    redirect(`/consent?next=${encodeURIComponent(next)}&error=${encodeURIComponent("동의 내역을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.")}`);
  }

  redirect(next);
}

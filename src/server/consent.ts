import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/domain/auth";
import { hasCurrentRequiredPolicies, requiredPolicyRows } from "@/domain/consent";

export async function hasRequiredPolicyConsents(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_consents")
    .select("policy_type, version")
    .eq("user_id", userId);

  if (error) return false;
  return hasCurrentRequiredPolicies(data ?? []);
}

export async function requirePolicyConsents(
  supabase: SupabaseClient,
  userId: string,
  next: string,
): Promise<void> {
  if (!await hasRequiredPolicyConsents(supabase, userId)) {
    redirect(`/consent?next=${encodeURIComponent(safeRedirectPath(next))}`);
  }
}

export async function saveRequiredPolicyConsents(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("user_consents")
    .upsert(requiredPolicyRows(userId), {
      onConflict: "user_id,policy_type,version",
      ignoreDuplicates: true,
    });
  return !error;
}

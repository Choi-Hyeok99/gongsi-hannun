"use server";

import { redirect } from "next/navigation";
import { hasRecentAuthentication, parseDeleteAccountForm } from "@/domain/account";
import { createSupabaseAdminClient } from "@/server/account";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requirePolicyConsents } from "@/server/consent";

function accountError(message: string): never {
  redirect(`/account?error=${encodeURIComponent(message)}`);
}

export async function deleteAccount(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect(`/login?next=${encodeURIComponent("/account")}`);
  }
  await requirePolicyConsents(supabase, user.id, "/account");

  if (!hasRecentAuthentication(user.last_sign_in_at)) {
    const message = "탈퇴 전 본인 확인을 위해 다시 로그인해 주세요.";
    redirect(`/login?next=${encodeURIComponent("/account")}&message=${encodeURIComponent(message)}`);
  }

  const parsed = parseDeleteAccountForm(formData, user.email);
  if (!parsed.success) accountError(parsed.message);

  let deletionError = false;
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    deletionError = Boolean(error);
  } catch {
    deletionError = true;
  }

  if (deletionError) {
    accountError("계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  await supabase.auth.signOut();
  redirect("/?message=" + encodeURIComponent("회원 탈퇴가 완료되었습니다."));
}

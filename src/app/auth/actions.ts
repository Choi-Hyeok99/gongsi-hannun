"use server";

import { redirect } from "next/navigation";
import {
  parseEmailForm,
  parseLoginForm,
  parsePasswordUpdateForm,
  parseSignUpForm,
  safeRedirectPath,
} from "@/domain/auth";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { readSiteUrl } from "@/server/supabase/config";

function redirectWithMessage(path: string, kind: "error" | "message", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const parsed = parseLoginForm(formData);
  if (!parsed.success) redirectWithMessage("/login", "error", parsed.message);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirectWithMessage("/login", "error", "이메일 또는 비밀번호를 확인해 주세요.");

  redirect(safeRedirectPath(formData.get("next")?.toString() ?? null));
}

export async function signUp(formData: FormData) {
  const parsed = parseSignUpForm(formData);
  if (!parsed.success) redirectWithMessage("/signup", "error", parsed.message);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${readSiteUrl()}/auth/callback` },
  });
  if (error) redirectWithMessage("/signup", "error", "회원가입을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");

  redirectWithMessage("/signup", "message", "가입 확인 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해 주세요.");
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = parseEmailForm(formData);
  if (!parsed.success) redirectWithMessage("/forgot-password", "error", parsed.message);

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${readSiteUrl()}/auth/callback?next=/reset-password`,
  });

  redirectWithMessage(
    "/forgot-password",
    "message",
    "가입된 이메일이라면 비밀번호 재설정 링크가 전송됩니다.",
  );
}

export async function updatePassword(formData: FormData) {
  const parsed = parsePasswordUpdateForm(formData);
  if (!parsed.success) redirectWithMessage("/reset-password", "error", parsed.message);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirectWithMessage("/reset-password", "error", "재설정 링크가 만료되었습니다. 새 링크를 요청해 주세요.");

  await supabase.auth.signOut();
  redirectWithMessage("/login", "message", "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

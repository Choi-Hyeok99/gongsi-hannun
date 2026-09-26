import type { ValidationResult } from "@/domain/auth";

export type DeleteAccountInput = Readonly<{
  emailConfirmation: string;
}>;

export const ACCOUNT_DELETION_REAUTH_WINDOW_MS = 10 * 60 * 1000;

export function connectedLoginMethods(metadata: Readonly<{ provider?: unknown; providers?: unknown }> | null | undefined): readonly string[] {
  const names = new Set<string>();
  const providers = Array.isArray(metadata?.providers) ? metadata.providers : [];
  for (const provider of [metadata?.provider, ...providers]) {
    if (provider === "email") names.add("이메일");
    if (provider === "kakao") names.add("카카오");
  }
  return [...names];
}

export function hasRecentAuthentication(
  lastSignedInAt: string | undefined,
  now = Date.now(),
): boolean {
  if (!lastSignedInAt) return false;
  const signedInAt = Date.parse(lastSignedInAt);
  return Number.isFinite(signedInAt)
    && signedInAt <= now
    && now - signedInAt <= ACCOUNT_DELETION_REAUTH_WINDOW_MS;
}

export function parseDeleteAccountForm(
  formData: FormData,
  currentEmail: string | undefined,
): ValidationResult<DeleteAccountInput> {
  const emailConfirmation = formData.get("emailConfirmation")?.toString().trim().toLowerCase() ?? "";
  const deleteConfirmation = formData.get("deleteConfirmation")?.toString().trim() ?? "";
  const irreversibleConfirmed = formData.get("irreversibleConfirmed") === "on";

  if (!currentEmail || emailConfirmation !== currentEmail.trim().toLowerCase()) {
    return { success: false, message: "현재 계정의 이메일을 정확히 입력해 주세요." };
  }
  if (deleteConfirmation !== "탈퇴") {
    return { success: false, message: "확인 문구에 ‘탈퇴’를 입력해 주세요." };
  }
  if (!irreversibleConfirmed) {
    return { success: false, message: "삭제 후 복구할 수 없다는 내용을 확인해 주세요." };
  }

  return { success: true, data: { emailConfirmation } };
}

export const REQUIRED_POLICY_VERSIONS = {
  TERMS: "2026-09-26",
  PRIVACY: "2026-09-26",
} as const;

export type RequiredPolicyType = keyof typeof REQUIRED_POLICY_VERSIONS;

export function requiredPolicyRows(userId: string) {
  return (Object.entries(REQUIRED_POLICY_VERSIONS) as Array<[
    RequiredPolicyType,
    string,
  ]>).map(([policy_type, version]) => ({ user_id: userId, policy_type, version }));
}

export function hasCurrentRequiredPolicies(
  rows: ReadonlyArray<Readonly<{ policy_type: string; version: string }>>,
): boolean {
  return (Object.entries(REQUIRED_POLICY_VERSIONS) as Array<[
    RequiredPolicyType,
    string,
  ]>).every(([policyType, version]) =>
    rows.some((row) => row.policy_type === policyType && row.version === version),
  );
}

export function parseRequiredPolicyAgreement(formData: FormData) {
  const termsAccepted = formData.get("termsAccepted") === "on";
  const privacyAccepted = formData.get("privacyAccepted") === "on";

  if (!termsAccepted || !privacyAccepted) {
    return {
      success: false as const,
      message: "이용약관과 개인정보처리방침에 모두 동의해 주세요.",
    };
  }

  return { success: true as const };
}

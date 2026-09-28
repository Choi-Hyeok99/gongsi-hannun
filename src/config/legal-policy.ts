import { z } from "zod";

const optionalText = z.string().trim().min(1).optional().catch(undefined);
const optionalEmail = z.email().optional().catch(undefined);
const optionalDate = z.iso.date().optional().catch(undefined);

const schema = z.object({
  operatorName: optionalText,
  operatorAddress: optionalText,
  supportEmail: optionalEmail,
  privacyEmail: optionalEmail,
  privacyOfficer: optionalText,
  effectiveDate: optionalDate,
  backupRetention: optionalText,
  supabaseProcessing: optionalText,
  cloudflareProcessing: optionalText,
  geminiProcessing: optionalText,
  kakaoDataFields: optionalText,
  krxUsageBasis: optionalText,
  changeNoticeDays: z.coerce.number().int().min(1).max(90).optional().catch(undefined),
});

export type LegalPolicyConfig = z.infer<typeof schema>;

export const LEGAL_POLICY_FIELD_LABELS: Readonly<Record<keyof LegalPolicyConfig, string>> = {
  operatorName: "운영자명 또는 사업자명",
  operatorAddress: "운영자 주소",
  supportEmail: "서비스 문의 이메일",
  privacyEmail: "개인정보 문의 이메일",
  privacyOfficer: "개인정보 담당자 또는 담당 부서",
  effectiveDate: "정책 시행일",
  backupRetention: "백업·로그 보유기간과 삭제 절차",
  supabaseProcessing: "Supabase 처리 위치·보유기간",
  cloudflareProcessing: "Cloudflare 처리 위치·보유기간",
  geminiProcessing: "Gemini 전달 항목·처리 위치·보유기간",
  kakaoDataFields: "카카오 로그인 제공 개인정보 항목",
  krxUsageBasis: "KRX 데이터 공개 이용 근거",
  changeNoticeDays: "중요 정책 변경 사전 안내 기간",
};

export function readLegalPolicyConfig(environment: Readonly<Record<string, string | undefined>> = process.env): LegalPolicyConfig {
  return schema.parse({
    operatorName: environment.LEGAL_OPERATOR_NAME,
    operatorAddress: environment.LEGAL_OPERATOR_ADDRESS,
    supportEmail: environment.LEGAL_SUPPORT_EMAIL,
    privacyEmail: environment.LEGAL_PRIVACY_EMAIL,
    privacyOfficer: environment.LEGAL_PRIVACY_OFFICER,
    effectiveDate: environment.LEGAL_EFFECTIVE_DATE,
    backupRetention: environment.LEGAL_BACKUP_RETENTION,
    supabaseProcessing: environment.LEGAL_SUPABASE_PROCESSING,
    cloudflareProcessing: environment.LEGAL_CLOUDFLARE_PROCESSING,
    geminiProcessing: environment.LEGAL_GEMINI_PROCESSING,
    kakaoDataFields: environment.LEGAL_KAKAO_DATA_FIELDS,
    krxUsageBasis: environment.LEGAL_KRX_USAGE_BASIS,
    changeNoticeDays: environment.LEGAL_CHANGE_NOTICE_DAYS,
  });
}

export function missingLegalPolicyFields(config: LegalPolicyConfig): readonly string[] {
  return (Object.keys(LEGAL_POLICY_FIELD_LABELS) as (keyof LegalPolicyConfig)[])
    .filter((field) => config[field] === undefined)
    .map((field) => LEGAL_POLICY_FIELD_LABELS[field]);
}

export function isLegalPolicyReady(config: LegalPolicyConfig): boolean {
  return missingLegalPolicyFields(config).length === 0;
}

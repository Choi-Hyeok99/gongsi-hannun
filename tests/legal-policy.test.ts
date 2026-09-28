import { describe, expect, it } from "vitest";
import { isLegalPolicyReady, missingLegalPolicyFields, readLegalPolicyConfig } from "@/config/legal-policy";

const completeEnvironment: Record<string, string> = {
  LEGAL_OPERATOR_NAME: "공시한눈 운영자",
  LEGAL_OPERATOR_ADDRESS: "서울특별시 테스트로 1",
  LEGAL_SUPPORT_EMAIL: "support@gongsihannun.com",
  LEGAL_PRIVACY_EMAIL: "privacy@gongsihannun.com",
  LEGAL_PRIVACY_OFFICER: "개인정보 담당자",
  LEGAL_EFFECTIVE_DATE: "2026-10-01",
  LEGAL_BACKUP_RETENTION: "탈퇴 후 30일 이내 순차 삭제",
  LEGAL_SUPABASE_PROCESSING: "대한민국 리전에서 계정·서비스 데이터를 처리",
  LEGAL_CLOUDFLARE_PROCESSING: "글로벌 네트워크에서 접속 요청과 보안 로그를 처리",
  LEGAL_GEMINI_PROCESSING: "공개 공시 원문만 전송하며 계정 개인정보는 전송하지 않음",
  LEGAL_KAKAO_DATA_FIELDS: "이메일 주소와 카카오 계정 식별자",
  LEGAL_KRX_USAGE_BASIS: "확인된 KRX Open API 이용조건",
  LEGAL_CHANGE_NOTICE_DAYS: "7",
};

describe("legal policy configuration", () => {
  it("lists every unresolved publication fact instead of inventing it", () => {
    const config = readLegalPolicyConfig({});
    expect(isLegalPolicyReady(config)).toBe(false);
    expect(missingLegalPolicyFields(config)).toContain("운영자명 또는 사업자명");
    expect(missingLegalPolicyFields(config)).toContain("KRX 데이터 공개 이용 근거");
  });

  it("accepts a complete, validated publication configuration", () => {
    const config = readLegalPolicyConfig(completeEnvironment);
    expect(isLegalPolicyReady(config)).toBe(true);
    expect(missingLegalPolicyFields(config)).toEqual([]);
    expect(config.changeNoticeDays).toBe(7);
  });

  it("does not treat malformed email and dates as finalized legal facts", () => {
    const config = readLegalPolicyConfig({
      ...completeEnvironment,
      LEGAL_PRIVACY_EMAIL: "not-an-email",
      LEGAL_EFFECTIVE_DATE: "October someday",
    });
    expect(missingLegalPolicyFields(config)).toEqual(expect.arrayContaining([
      "개인정보 문의 이메일",
      "정책 시행일",
    ]));
  });
});

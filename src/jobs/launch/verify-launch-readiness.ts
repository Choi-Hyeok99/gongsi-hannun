import { missingLegalPolicyFields, readLegalPolicyConfig } from "@/config/legal-policy";
import { GeminiDisclosureSummaryClient } from "@/jobs/analyzer/gemini-summary-client";

type AuthSettings = Readonly<{
  external?: Readonly<{ email?: boolean; kakao?: boolean }>;
  disable_signup?: boolean;
  mailer_autoconfirm?: boolean;
}>;

async function main() {
  const blockers: string[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !publishableKey) {
    blockers.push("Supabase 공개 URL 또는 publishable key가 없음");
  } else {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
    });
    if (!response.ok) {
      blockers.push(`Supabase 인증 설정 조회 실패 (${response.status})`);
    } else {
      const settings = await response.json() as AuthSettings;
      if (!settings.external?.email) blockers.push("이메일 로그인이 비활성화됨");
      if (!settings.external?.kakao) blockers.push("카카오 로그인이 비활성화됨");
      if (settings.disable_signup) blockers.push("신규 회원가입이 비활성화됨");
      if (settings.mailer_autoconfirm) blockers.push("이메일 확인 없이 가입이 자동 승인되도록 설정됨");
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(siteUrl)) {
    blockers.push("운영 NEXT_PUBLIC_SITE_URL이 확정되지 않음");
  }
  if (!process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim()) blockers.push("웹푸시 VAPID 공개키가 런타임에 없음");
  if (!process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim()) blockers.push("웹푸시 VAPID 개인키가 런타임에 없음");
  if (!process.env.WEB_PUSH_VAPID_SUBJECT?.trim()) blockers.push("웹푸시 VAPID 연락처가 런타임에 없음");

  for (const field of missingLegalPolicyFields(readLegalPolicyConfig())) blockers.push(`법적 정보 미확정: ${field}`);

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    blockers.push("Gemini API 키가 없음");
  } else {
    try {
      await new GeminiDisclosureSummaryClient({
        apiKey: geminiKey,
        model: process.env.GEMINI_MODEL,
        timeoutMs: 10_000,
      }).assertAvailable();
    } catch (error) {
      blockers.push(`Gemini 사전 점검 실패: ${safeErrorCode(error)}`);
    }
  }

  if (blockers.length > 0) {
    console.error(`출시 준비 미완료 (${blockers.length}개)`);
    for (const blocker of blockers) console.error(`- ${blocker}`);
    process.exitCode = 1;
    return;
  }
  console.log("출시 준비 점검 통과: 인증 공급자, 운영 URL, 웹푸시 키, 법적 정보, Gemini 접근 확인");
}

function safeErrorCode(error: unknown): string {
  if (error instanceof Error && /^AI_[A-Z_]+$/.test(error.message)) return error.message;
  return "AI_PROVIDER_UNAVAILABLE";
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "출시 준비 점검 실패");
  process.exitCode = 1;
});

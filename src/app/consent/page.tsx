import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import { redirect } from "next/navigation";
import { AuthMessage } from "@/components/AuthMessage";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { safeRedirectPath } from "@/domain/auth";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { acceptRequiredPolicies } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "필수 동의 | 공시한눈" };

type Props = Readonly<{ searchParams: Promise<{ error?: string; next?: string }> }>;

export default async function ConsentPage({ searchParams }: Props) {
  const parameters = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/consent")}`);

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container auth-page">
        <section className="auth-card" aria-labelledby="consent-heading">
          <p className="eyebrow">서비스 이용 전 확인</p>
          <h1 id="consent-heading">필수 동의</h1>
          <p className="auth-description">계정을 계속 사용하려면 연령과 정책을 확인해 주세요. 선택 광고·마케팅 동의는 포함되지 않습니다.</p>
          <AuthMessage error={parameters.error} />
          <p className="policy-draft-notice" role="note">정책의 운영자 정보 등 미확정 항목은 정식 공개 전 확정 필요합니다.</p>
          <form action={acceptRequiredPolicies} className="auth-form">
            <input type="hidden" name="next" value={safeRedirectPath(parameters.next ?? null)} />
            <fieldset className="policy-consents">
              <legend>필수 확인</legend>
              <label><input name="ageConfirmed" type="checkbox" value="on" required /><span>만 14세 이상입니다. (필수)</span></label>
              <label><input name="termsAccepted" type="checkbox" value="on" required /><span><Link href="/terms" target="_blank" rel="noopener noreferrer">이용약관</Link>에 동의합니다. (필수)</span></label>
              <label><input name="privacyAcknowledged" type="checkbox" value="on" required /><span><Link href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리방침</Link>을 확인했습니다. (필수 확인)</span></label>
            </fieldset>
            <button type="submit">동의하고 계속하기</button>
          </form>
          <div className="auth-links"><Link href="/account">내 정보로 돌아가기</Link></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

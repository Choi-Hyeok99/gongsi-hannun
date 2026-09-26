import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import { loginWithKakao, signUp } from "@/app/auth/actions";
import { AuthMessage } from "@/components/AuthMessage";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "회원가입 | 공시한눈" };
type Props = Readonly<{ searchParams: Promise<{ error?: string; message?: string }> }>;

export default async function SignUpPage({ searchParams }: Props) {
  const parameters = await searchParams;
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container auth-page">
        <section className="auth-card" aria-labelledby="signup-heading">
          <p className="eyebrow">공시한눈 시작하기</p>
          <h1 id="signup-heading">회원가입</h1>
          <p className="auth-description">이메일 인증 후 서비스를 이용할 수 있습니다.</p>
          <AuthMessage error={parameters.error} message={parameters.message} />
          <form action={loginWithKakao}>
            <button className="kakao-login-button" type="submit">
              <span aria-hidden="true">●</span>
              카카오로 간편 가입
            </button>
          </form>
          <div className="auth-divider"><span>또는 이메일로 가입</span></div>
          <form className="auth-form" action={signUp}>
            <label>이메일<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
            <label>비밀번호<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} aria-describedby="password-help" /></label>
            <small id="password-help">12자 이상 72자 이하로 입력해 주세요.</small>
            <label>비밀번호 확인<input name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
            <fieldset className="policy-consents">
              <legend>가입 전 필수 확인</legend>
              <label><input name="ageConfirmed" type="checkbox" value="on" required /><span>만 14세 이상입니다. (필수)</span></label>
              <label><input name="termsAccepted" type="checkbox" value="on" required /><span><Link href="/terms" target="_blank" rel="noopener noreferrer">이용약관</Link>에 동의합니다. (필수)</span></label>
              <label><input name="privacyAcknowledged" type="checkbox" value="on" required /><span><Link href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리방침</Link>을 확인했습니다. (필수 확인)</span></label>
              <small>정책의 미확정 항목은 정식 공개 전에 확정되어야 합니다.</small>
            </fieldset>
            <button type="submit">인증 메일 받기</button>
          </form>
          <div className="auth-links"><span>이미 계정이 있나요?</span><Link href="/login">로그인</Link></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

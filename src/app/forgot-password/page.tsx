import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";
import { AuthMessage } from "@/components/AuthMessage";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "비밀번호 찾기 | 공시한눈" };
type Props = Readonly<{ searchParams: Promise<{ error?: string; message?: string }> }>;

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const parameters = await searchParams;
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container auth-page">
        <section className="auth-card" aria-labelledby="forgot-heading">
          <p className="eyebrow">계정 복구</p>
          <h1 id="forgot-heading">비밀번호 찾기</h1>
          <p className="auth-description">가입한 이메일로 안전한 재설정 링크를 보내드립니다.</p>
          <AuthMessage error={parameters.error} message={parameters.message} />
          <form className="auth-form" action={requestPasswordReset}>
            <label>이메일<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
            <button type="submit">재설정 링크 받기</button>
          </form>
          <div className="auth-links"><Link href="/login">로그인으로 돌아가기</Link></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

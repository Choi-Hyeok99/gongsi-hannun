import type { Metadata } from "next";
import Link from "next/link";
import { login, loginWithKakao } from "@/app/auth/actions";
import { AuthMessage } from "@/components/AuthMessage";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { safeRedirectPath } from "@/domain/auth";

export const metadata: Metadata = { title: "로그인 | 공시한눈" };

type Props = Readonly<{ searchParams: Promise<{ error?: string; message?: string; next?: string }> }>;

export default async function LoginPage({ searchParams }: Props) {
  const parameters = await searchParams;
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container auth-page">
        <section className="auth-card" aria-labelledby="login-heading">
          <p className="eyebrow">다시 만나서 반가워요</p>
          <h1 id="login-heading">로그인</h1>
          <p className="auth-description">관심기업과 알림 설정을 안전하게 관리하세요.</p>
          <AuthMessage error={parameters.error} message={parameters.message} />
          <form action={loginWithKakao}>
            <input type="hidden" name="next" value={safeRedirectPath(parameters.next ?? null)} />
            <button className="kakao-login-button" type="submit">
              <span aria-hidden="true">●</span>
              카카오로 계속하기
            </button>
          </form>
          <div className="auth-divider"><span>또는 이메일로 로그인</span></div>
          <form className="auth-form" action={login}>
            <input type="hidden" name="next" value={safeRedirectPath(parameters.next ?? null)} />
            <label>이메일<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
            <label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label>
            <button type="submit">로그인</button>
          </form>
          <div className="auth-links"><Link href="/forgot-password">비밀번호 찾기</Link><Link href="/signup">회원가입</Link></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

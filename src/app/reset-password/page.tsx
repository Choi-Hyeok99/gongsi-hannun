import type { Metadata } from "next";
import Link from "next/link";
import { updatePassword } from "@/app/auth/actions";
import { AuthMessage } from "@/components/AuthMessage";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "비밀번호 재설정 | 공시한눈" };
type Props = Readonly<{ searchParams: Promise<{ error?: string }> }>;

export default async function ResetPasswordPage({ searchParams }: Props) {
  const parameters = await searchParams;
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container auth-page">
        <section className="auth-card" aria-labelledby="reset-heading">
          <p className="eyebrow">계정 복구</p>
          <h1 id="reset-heading">새 비밀번호 설정</h1>
          <p className="auth-description">메일로 받은 링크를 통해 들어온 경우 새 비밀번호를 설정할 수 있습니다.</p>
          <AuthMessage error={parameters.error} />
          <form className="auth-form" action={updatePassword}>
            <label>새 비밀번호<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
            <label>새 비밀번호 확인<input name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
            <button type="submit">비밀번호 변경</button>
          </form>
          <div className="auth-links"><Link href="/forgot-password">새 링크 요청하기</Link></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

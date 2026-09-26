import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { AuthMessage } from "@/components/AuthMessage";
import { connectedLoginMethods } from "@/domain/account";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { deleteAccount } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "내 정보 | 공시한눈" };

type Props = Readonly<{ searchParams: Promise<{ error?: string; message?: string }> }>;

function formatJoinedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "확인 불가" : new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }).format(date);
}

export default async function AccountPage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/account")}&message=${encodeURIComponent("로그인 후 내 정보를 확인할 수 있습니다.")}`);

  const [watchlistResult, pushResult, status] = await Promise.all([
    supabase.from("watchlist_companies").select("company_id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("web_push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("disabled_at", null),
    searchParams,
  ]);
  const loginMethods = connectedLoginMethods(user.app_metadata);
  const loginMethod = loginMethods.join(" · ") || "확인 불가";
  const email = user.email ?? "확인 불가";

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content account-page">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>내 정보</span></div>
        <section className="page-intro">
          <p className="eyebrow">계정 관리</p>
          <h1>내 정보</h1>
          <p>계정과 개인화 설정을 한곳에서 확인할 수 있습니다.</p>
        </section>
        <AuthMessage error={status.error} message={status.message} />
        <div className="account-grid">
          <section className="info-card" aria-labelledby="account-profile-heading">
            <h2 id="account-profile-heading">계정 정보</h2>
            <dl className="company-facts">
              <div><dt>이메일</dt><dd>{email}</dd></div>
              <div><dt>가입일</dt><dd>{formatJoinedAt(user.created_at)}</dd></div>
              <div><dt>연결된 로그인 방식</dt><dd>{loginMethod}</dd></div>
            </dl>
            {loginMethods.includes("이메일") ? <Link className="text-link" href="/forgot-password">비밀번호 변경 메일 받기 →</Link> : null}
          </section>
          <section className="info-card" aria-labelledby="account-personalization-heading">
            <h2 id="account-personalization-heading">개인화 현황</h2>
            <dl className="account-stats">
              <div><dt>관심기업</dt><dd>{watchlistResult.error ? "확인 불가" : `${watchlistResult.count ?? 0}개`}</dd></div>
              <div><dt>활성 푸시 기기</dt><dd>{pushResult.error ? "확인 불가" : `${pushResult.count ?? 0}개`}</dd></div>
            </dl>
            <div className="account-actions"><Link className="secondary-button" href="/watchlist">관심기업 관리</Link><Link className="secondary-button" href="/notifications">알림 관리</Link></div>
          </section>
        </div>
        <section className="info-card account-policy" aria-labelledby="account-policy-heading">
          <h2 id="account-policy-heading">정책 및 로그인</h2>
          <div className="account-actions"><Link href="/terms">이용약관</Link><Link href="/privacy">개인정보 처리방침</Link><form action={logout}><button className="secondary-button" type="submit">로그아웃</button></form></div>
        </section>
        <section className="account-danger" aria-labelledby="account-delete-heading">
          <div><p className="eyebrow">주의</p><h2 id="account-delete-heading">계정 탈퇴</h2><p>탈퇴하면 계정에 연결된 관심기업과 알림 설정 등 개인 데이터가 삭제되며 복구할 수 없습니다. 계속하려면 아래 내용을 모두 확인해 주세요.</p></div>
          <form action={deleteAccount} className="auth-form account-delete-form">
            <label>계정 이메일 확인<input name="emailConfirmation" type="email" autoComplete="email" required placeholder={user.email ?? "계정 이메일"} aria-describedby="delete-email-help" /></label>
            <small id="delete-email-help">현재 계정의 이메일을 정확히 입력하세요.</small>
            <label>확인 문구<input name="deleteConfirmation" type="text" required pattern="탈퇴" placeholder="탈퇴" aria-describedby="delete-word-help" /></label>
            <small id="delete-word-help">‘탈퇴’를 입력하세요.</small>
            <label className="account-delete-confirm"><input name="irreversibleConfirmed" type="checkbox" value="on" required /><span>데이터 삭제 후 복구할 수 없다는 점을 확인했습니다.</span></label>
            <button type="submit">계정 영구 탈퇴</button>
          </form>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

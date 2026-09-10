import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WatchlistAlertCard } from "@/components/WatchlistAlertCard";
import { SupabaseAlertPreferenceRepository } from "@/data/supabase-notification-center-repository";
import { createWatchlistCompanyReader } from "@/data/supabase-watchlist-company-reader";
import { SupabaseWatchlistRepository } from "@/data/supabase-watchlist-repository";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { listAlertPreferences } from "@/server/notification-center-use-cases";
import { listSavedCompanies } from "@/server/watchlist-use-cases";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "관심기업 | 공시한눈" };

type Props = Readonly<{ searchParams: Promise<{ message?: string; error?: string }> }>;

export default async function WatchlistPage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/watchlist")}&message=${encodeURIComponent("로그인 후 관심기업을 확인할 수 있습니다.")}`);
  }

  const companies = await listSavedCompanies(
    new SupabaseWatchlistRepository(supabase),
    createWatchlistCompanyReader(),
    user.id,
  );
  const preferences = await listAlertPreferences(
    new SupabaseAlertPreferenceRepository(supabase),
    user.id,
    companies.map((company) => company.id),
  );
  const status = await searchParams;

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>관심기업</span></div>
        <section className="page-intro">
          <p className="eyebrow">나만의 기업 목록</p>
          <h1>관심기업</h1>
          <p>저장한 기업의 정보와 공시를 확인하고, 내게 맞는 중요 알림 기준을 설정하세요.</p>
        </section>
        {status.message ? <p className="auth-message auth-message--success" role="status">{status.message}</p> : null}
        {status.error ? <p className="auth-message auth-message--error" role="alert">{status.error}</p> : null}
        <p className="alert-disclaimer">알림은 자동 분류된 공시 안내이며 투자 권유가 아닙니다. 중요한 결정 전 공시 원문을 확인하세요.</p>
        <section aria-labelledby="watchlist-heading">
          <div className="result-heading"><h2 id="watchlist-heading">저장한 기업</h2><span>{companies.length}개</span></div>
          {companies.length ? (
            <div className="result-list">{companies.map((company) => (
              <WatchlistAlertCard company={company} preference={preferences.get(company.id)} key={company.id} />
            ))}</div>
          ) : (
            <div className="empty-state">
              <strong>아직 저장한 관심기업이 없습니다.</strong>
              <p>기업 상세 화면에서 관심기업을 저장해 보세요.</p>
              <Link className="primary-link" href="/search?query=삼성">기업 찾아보기</Link>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

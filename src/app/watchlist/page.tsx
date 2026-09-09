import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CompanyResultCard } from "@/components/CompanyResultCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createWatchlistCompanyReader } from "@/data/supabase-watchlist-company-reader";
import { SupabaseWatchlistRepository } from "@/data/supabase-watchlist-repository";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { listSavedCompanies } from "@/server/watchlist-use-cases";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "관심기업 | 공시한눈" };

export default async function WatchlistPage() {
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

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>관심기업</span></div>
        <section className="page-intro">
          <p className="eyebrow">나만의 기업 목록</p>
          <h1>관심기업</h1>
          <p>저장한 기업의 정보와 공시를 빠르게 확인하세요.</p>
        </section>
        <section aria-labelledby="watchlist-heading">
          <div className="result-heading"><h2 id="watchlist-heading">저장한 기업</h2><span>{companies.length}개</span></div>
          {companies.length ? (
            <div className="result-list">{companies.map((company) => <CompanyResultCard company={company} key={company.id} />)}</div>
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

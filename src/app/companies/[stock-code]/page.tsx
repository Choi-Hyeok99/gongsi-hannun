import type { Metadata } from "next";
import Link from "next/link";
import { AuthMessage } from "@/components/AuthMessage";
import { DisclosureList } from "@/components/DisclosureList";
import { DailyPriceChart } from "@/components/DailyPriceChart";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WatchlistButton } from "@/components/WatchlistButton";
import { createCompanyRepository } from "@/data/supabase-company-repository";
import { createDisclosureRepository } from "@/data/supabase-disclosure-repository";
import { createDailyPriceQueryRepository } from "@/data/supabase-daily-price-query-repository";
import { createWatchlistCompanyReader } from "@/data/supabase-watchlist-company-reader";
import { SupabaseWatchlistRepository } from "@/data/supabase-watchlist-repository";
import { getCompany } from "@/server/company-use-cases";
import { listCompanyDisclosures } from "@/server/disclosure-use-cases";
import { getDailyPriceSnapshot } from "@/server/daily-price-use-cases";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getSavedState } from "@/server/watchlist-use-cases";

export const dynamic = "force-dynamic";

type Props = Readonly<{
  params: Promise<{ "stock-code": string }>;
  searchParams: Promise<{ error?: string; message?: string; period?: string }>;
}>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { "stock-code": stockCode } = await params;
  const company = await getCompany(createCompanyRepository(), stockCode);
  return {
    title: company ? `${company.name} | 공시한눈` : "기업 정보 | 공시한눈",
    description: company ? `${company.name}의 기업 정보와 주요 공시를 확인합니다.` : "상장기업 정보를 확인합니다.",
  };
}

export default async function CompanyPage({ params, searchParams }: Props) {
  const { "stock-code": stockCode } = await params;
  const status = await searchParams;
  const company = await getCompany(createCompanyRepository(), stockCode);

  if (!company) {
    return (
      <div className="site-shell">
        <SiteHeader />
        <main className="content-container page-content">
          <div className="empty-state empty-state--page">
            <strong>기업 정보를 찾지 못했습니다.</strong>
            <p>종목코드를 확인하거나 기업 검색을 이용해 주세요.</p>
            <Link className="primary-link" href="/search?query=삼성">기업 검색으로 이동</Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const [disclosures, priceSnapshot, supabase] = await Promise.all([
    listCompanyDisclosures(createDisclosureRepository(), stockCode, 10),
    getDailyPriceSnapshot(createDailyPriceQueryRepository(), stockCode, status.period ?? null),
    createSupabaseServerClient(),
  ]);
  const { data: { user } } = await supabase.auth.getUser();
  const watchlistCompany = user ? await createWatchlistCompanyReader().findByStockCode(stockCode) : null;
  const isSaved = user && watchlistCompany
    ? await getSavedState(new SupabaseWatchlistRepository(supabase), user.id, watchlistCompany.id)
    : false;
  const market = company.market === "OTHER" ? "시장 분류 준비 중" : company.market;
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><Link href={`/search?query=${encodeURIComponent(company.name)}`}>기업</Link><span>/</span><span>{company.name}</span></div>

        <AuthMessage error={status.error} message={status.message} />
        <section className="company-hero">
          <span className="company-avatar company-avatar--hero" aria-hidden="true">{company.name.slice(0, 1)}</span>
          <div>
            <p className="eyebrow">기업 정보</p>
            <h1>{company.name}</h1>
            <p>{company.stockCode} · {market}</p>
            <span className={company.industryCategory === "UNCLASSIFIED" ? "industry-badge industry-badge--muted" : "industry-badge"}>
              {company.industryCategoryLabel ?? "미분류"}
            </span>
          </div>
          <div className="company-hero__action">
            <WatchlistButton stockCode={stockCode} isAuthenticated={Boolean(user)} isSaved={isSaved} />
          </div>
        </section>

        <div className="detail-grid">
          <section className="info-card" aria-labelledby="company-info-heading">
            <div className="section-heading">
              <h2 id="company-info-heading">기본 정보</h2>
            </div>
            <dl className="company-facts">
              <div><dt>기업명</dt><dd>{company.name}</dd></div>
              <div><dt>종목코드</dt><dd>{company.stockCode}</dd></div>
              <div><dt>시장</dt><dd>{market}</dd></div>
              <div><dt>업종 분류</dt><dd>{company.industryCategoryLabel ?? "미분류"}</dd></div>
              <div><dt>세부 업종</dt><dd>{company.sector ?? "미분류"}</dd></div>
            </dl>
          </section>

          <aside className="info-card info-card--accent">
            <p className="eyebrow">데이터 상태</p>
            <h2>OpenDART 기업정보 연결 완료</h2>
            <p>업종은 공식 데이터의 세부 업종을 15개 표준 카테고리로 정리해 제공합니다.</p>
          </aside>
        </div>

        <section className="info-card price-section" aria-labelledby="daily-price-heading">
          <div className="section-heading price-section__heading">
            <div>
              <p className="eyebrow">일별 시세</p>
              <h2 id="daily-price-heading">주가 흐름</h2>
            </div>
            <nav className="period-tabs" aria-label="주가 조회 기간">
              {(["1M", "3M", "1Y"] as const).map((period) => (
                <Link
                  className={priceSnapshot.period === period ? "period-tab period-tab--active" : "period-tab"}
                  href={`/companies/${stockCode}?period=${period}`}
                  aria-current={priceSnapshot.period === period ? "page" : undefined}
                  key={period}
                >
                  {period}
                </Link>
              ))}
            </nav>
          </div>
          <DailyPriceChart companyName={company.name} snapshot={priceSnapshot} />
        </section>

        <section className="section" aria-labelledby="disclosure-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">공시 타임라인</p>
              <h2 id="disclosure-heading">최근 주요 공시</h2>
            </div>
            <Link className="text-link" href="/disclosures">전체 공시 보기</Link>
          </div>
          <DisclosureList disclosures={disclosures} emptyMessage="최근 수집된 기업 공시가 없습니다." />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

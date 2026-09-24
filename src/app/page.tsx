import Link from "next/link";
import { CompanySearchForm } from "@/components/CompanySearchForm";
import { DailyPriceChart } from "@/components/DailyPriceChart";
import { DisclosureList } from "@/components/DisclosureList";
import { HomeCompanyCount, HomeDisclosureCollectionStatus } from "@/components/HomeDataStatus";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createDisclosureRepository } from "@/data/supabase-disclosure-repository";
import { createCompanyRepository } from "@/data/supabase-company-repository";
import { createDailyPriceQueryRepository } from "@/data/supabase-daily-price-query-repository";
import { createHomeStatusRepository } from "@/data/supabase-home-status-repository";
import type { DailyPriceSnapshot } from "@/domain/daily-price";
import { listFeaturedCompanies } from "@/server/company-use-cases";
import { getDailyPriceSnapshotsOrEmpty } from "@/server/daily-price-use-cases";
import { listLatestDisclosures } from "@/server/disclosure-use-cases";
import { getHomeOperationalStatus } from "@/server/home-status-use-cases";

export const dynamic = "force-dynamic";

const PRICE_UNAVAILABLE: DailyPriceSnapshot = {
  status: "ERROR",
  period: "1M",
  points: [],
  latest: null,
  previous: null,
  sourceId: null,
  changeAmount: null,
  changeRate: null,
};

export default async function HomePage() {
  const [disclosureResult, companyResult, operationalStatus] = await Promise.all([
    Promise.resolve()
      .then(() => listLatestDisclosures(createDisclosureRepository(), 8))
      .then((items) => ({ items, failed: false as const }))
      .catch(() => ({ items: [], failed: true as const })),
    Promise.resolve()
      .then(() => listFeaturedCompanies(createCompanyRepository()))
      .then((companies) => ({ companies, failed: false as const }))
      .catch(() => ({ companies: [], failed: true as const })),
    getHomeOperationalStatus(createHomeStatusRepository),
  ]);
  const featuredPrices: Record<string, DailyPriceSnapshot> = companyResult.companies.length > 0
    ? await Promise.resolve()
        .then(() => getDailyPriceSnapshotsOrEmpty(
          createDailyPriceQueryRepository(),
          companyResult.companies.map((company) => company.stockCode),
          "1M",
        ))
        .catch(() => ({}))
    : {};

  return (
    <div className="site-shell">
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="content-container hero__content">
            <p className="eyebrow">복잡한 공시를 더 쉽게</p>
            <h1>기업 정보를 한눈에 찾아보세요</h1>
            <p className="hero__description">
              기업명이나 6자리 종목코드를 검색하면 OpenDART 기반 기업 정보를 바로 확인할 수 있습니다.
            </p>
            <CompanySearchForm autoFocus />
          </div>
        </section>

        <section className="content-container section" aria-labelledby="featured-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">빠른 탐색</p>
              <h2 id="featured-heading">대표 기업 둘러보기</h2>
            </div>
            <Link className="text-link" href="/search">
              더 많은 기업 보기
            </Link>
          </div>
          {companyResult.companies.length > 0 ? <div className="featured-grid">
            {companyResult.companies.map((company) => (
              <Link className="featured-card" href={`/companies/${company.stockCode}`} key={company.stockCode}>
                <span className="featured-card__heading">
                  <span className="company-avatar" aria-hidden="true">{company.name.slice(0, 1)}</span>
                  <span className="featured-card__identity">
                    <strong>{company.name}</strong>
                    <small>{company.stockCode}</small>
                    <span className={company.industryCategory === "UNCLASSIFIED" ? "industry-badge industry-badge--muted" : "industry-badge"}>
                      {company.industryCategoryLabel ?? "업종 미분류"}
                    </span>
                  </span>
                  <span className="card-arrow" aria-hidden="true">→</span>
                </span>
                <DailyPriceChart companyName={company.name} snapshot={featuredPrices[company.stockCode] ?? PRICE_UNAVAILABLE} compact />
              </Link>
            ))}
          </div> : (
            <div className="empty-state">
              <strong>{companyResult.failed ? "대표 기업을 불러오지 못했습니다." : "표시할 대표 기업이 없습니다."}</strong>
              <p>{companyResult.failed ? "연결 상태를 확인한 뒤 기업 검색에서 다시 시도해 주세요." : "선정한 기업의 최신 정보를 아직 확인하지 못했습니다."}</p>
              <Link className="primary-link" href="/search">기업 검색으로 이동</Link>
            </div>
          )}
        </section>

        <section className="content-container section" aria-labelledby="home-disclosures-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">평일 10분 간격 수집</p>
              <h2 id="home-disclosures-heading">최근 주요 공시</h2>
            </div>
            <Link className="text-link" href="/disclosures">전체 공시 보기</Link>
          </div>
          <HomeDisclosureCollectionStatus status={operationalStatus} />
          <DisclosureList
            disclosures={disclosureResult.items}
            emptyState={disclosureResult.failed ? {
              title: "최신 공시를 불러오지 못했습니다.",
              description: "데이터 연결 상태를 확인한 뒤 전체 공시 화면에서 다시 시도해 주세요.",
              action: { href: "/disclosures", label: "전체 공시에서 다시 보기" },
            } : undefined}
          />
        </section>

        <section className="content-container section">
          <div className="notice-card">
            <div>
              <p className="eyebrow">데이터 안내</p>
              <HomeCompanyCount count={operationalStatus.activeCompanyCount} />
            </div>
            <p>OpenDART 공시와 KRX 일별 종가는 각 데이터에 표시된 기준일과 최근 성공 수집 시각을 기준으로 확인할 수 있습니다.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

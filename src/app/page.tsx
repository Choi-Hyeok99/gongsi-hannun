import Link from "next/link";
import { CompanySearchForm } from "@/components/CompanySearchForm";
import { DailyPriceChart } from "@/components/DailyPriceChart";
import { DisclosureList } from "@/components/DisclosureList";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createDisclosureRepository } from "@/data/supabase-disclosure-repository";
import { createDailyPriceQueryRepository } from "@/data/supabase-daily-price-query-repository";
import { getDailyPriceSnapshot } from "@/server/daily-price-use-cases";
import { listLatestDisclosures } from "@/server/disclosure-use-cases";

export const dynamic = "force-dynamic";

const featuredCompanies = [
  { name: "삼성전자", stockCode: "005930" },
  { name: "SK하이닉스", stockCode: "000660" },
  { name: "NAVER", stockCode: "035420" },
  { name: "카카오", stockCode: "035720" },
  { name: "현대차", stockCode: "005380" },
  { name: "LG화학", stockCode: "051910" },
] as const;

export default async function HomePage() {
  const dailyPriceRepository = createDailyPriceQueryRepository();
  const [latestDisclosures, featuredPrices] = await Promise.all([
    listLatestDisclosures(createDisclosureRepository(), 8),
    Promise.all(featuredCompanies.map((company) => getDailyPriceSnapshot(dailyPriceRepository, company.stockCode, "1M"))),
  ]);

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
              <h2 id="featured-heading">주요 기업</h2>
            </div>
            <Link className="text-link" href="/search?query=삼성">
              기업 검색하기
            </Link>
          </div>
          <div className="featured-grid">
            {featuredCompanies.map((company, index) => (
              <Link className="featured-card" href={`/companies/${company.stockCode}`} key={company.stockCode}>
                <span className="featured-card__heading">
                  <span className="company-avatar" aria-hidden="true">{company.name.slice(0, 1)}</span>
                  <span className="featured-card__identity">
                    <strong>{company.name}</strong>
                    <small>{company.stockCode}</small>
                  </span>
                  <span className="card-arrow" aria-hidden="true">→</span>
                </span>
                <DailyPriceChart companyName={company.name} snapshot={featuredPrices[index]!} compact />
              </Link>
            ))}
          </div>
        </section>

        <section className="content-container section" aria-labelledby="home-disclosures-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">실시간 업데이트</p>
              <h2 id="home-disclosures-heading">오늘의 주요 공시</h2>
            </div>
            <Link className="text-link" href="/disclosures">전체 공시 보기</Link>
          </div>
          <DisclosureList disclosures={latestDisclosures} />
        </section>

        <section className="content-container section">
          <div className="notice-card">
            <div>
              <p className="eyebrow">데이터 안내</p>
              <h2>3,931개 상장기업 정보를 연결했습니다</h2>
            </div>
            <p>OpenDART에서 수집한 최신 공시를 기업별 타임라인과 함께 제공합니다.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

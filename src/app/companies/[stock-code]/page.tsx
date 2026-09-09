import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createCompanyRepository } from "@/data/supabase-company-repository";
import { getCompany } from "@/server/company-use-cases";

export const dynamic = "force-dynamic";

type Props = Readonly<{
  params: Promise<{ "stock-code": string }>;
}>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { "stock-code": stockCode } = await params;
  const company = await getCompany(createCompanyRepository(), stockCode);
  return {
    title: company ? `${company.name} | 공시한눈` : "기업 정보 | 공시한눈",
    description: company ? `${company.name}의 기업 정보와 주요 공시를 확인합니다.` : "상장기업 정보를 확인합니다.",
  };
}

export default async function CompanyPage({ params }: Props) {
  const { "stock-code": stockCode } = await params;
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

  const market = company.market === "OTHER" ? "시장 분류 준비 중" : company.market;
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><Link href={`/search?query=${encodeURIComponent(company.name)}`}>기업</Link><span>/</span><span>{company.name}</span></div>

        <section className="company-hero">
          <span className="company-avatar company-avatar--hero" aria-hidden="true">{company.name.slice(0, 1)}</span>
          <div>
            <p className="eyebrow">기업 정보</p>
            <h1>{company.name}</h1>
            <p>{company.stockCode} · {market}</p>
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
              <div><dt>업종</dt><dd>{company.sector ?? "업종 정보 준비 중"}</dd></div>
            </dl>
          </section>

          <aside className="info-card info-card--accent">
            <p className="eyebrow">데이터 상태</p>
            <h2>OpenDART 기업정보 연결 완료</h2>
            <p>시장·업종 분류는 공식 데이터 확인 후 제공됩니다.</p>
          </aside>
        </div>

        <section className="section" aria-labelledby="disclosure-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">공시 타임라인</p>
              <h2 id="disclosure-heading">최근 주요 공시</h2>
            </div>
          </div>
          <div className="empty-state">
            <strong>아직 수집된 공시가 없습니다.</strong>
            <p>다음 단계에서 OpenDART 공시 수집기를 연결하면 이곳에 실제 공시가 표시됩니다.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

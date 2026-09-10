import type { Metadata } from "next";
import Link from "next/link";
import { CompanyCategoryFilter } from "@/components/CompanyCategoryFilter";
import { CompanyResultCard } from "@/components/CompanyResultCard";
import { CompanySearchForm } from "@/components/CompanySearchForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createCompanyRepository } from "@/data/supabase-company-repository";
import { createDailyPriceQueryRepository } from "@/data/supabase-daily-price-query-repository";
import { COMPANY_INDUSTRY_CATEGORIES, COMPANY_INDUSTRY_CATEGORY_LABELS } from "@/domain/company";
import type { DailyPriceSnapshot } from "@/domain/daily-price";
import { DataAccessError, InvalidInputError } from "@/domain/errors";
import { browseCompaniesPage, type PublicCompanyPage } from "@/server/company-use-cases";
import { getDailyPriceSnapshotsOrEmpty } from "@/server/daily-price-use-cases";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "기업 검색 | 공시한눈",
  description: "기업명이나 종목코드로 상장기업을 검색합니다.",
};

type Props = Readonly<{
  searchParams: Promise<{ query?: string | string[]; category?: string | string[]; page?: string | string[] }>;
}>;

const EMPTY_RESULT: PublicCompanyPage = { companies: [], total: 0, page: 1, pageSize: 24, totalPages: 1 };

export default async function SearchPage({ searchParams }: Props) {
  const parameters = await searchParams;
  const rawQuery = typeof parameters.query === "string" ? parameters.query : "";
  const rawCategory = typeof parameters.category === "string" ? parameters.category : "";
  const rawPage = typeof parameters.page === "string" ? parameters.page : "1";
  const selectedCategory = COMPANY_INDUSTRY_CATEGORIES.find((category) => category === rawCategory);
  const selectedCategoryLabel = selectedCategory ? COMPANY_INDUSTRY_CATEGORY_LABELS[selectedCategory] : null;
  let result = EMPTY_RESULT;
  let priceSnapshots: Readonly<Record<string, DailyPriceSnapshot>> = {};
  let message: string | null = null;

  try {
    result = await browseCompaniesPage(createCompanyRepository(), rawQuery, rawCategory, rawPage);
    priceSnapshots = await getDailyPriceSnapshotsOrEmpty(
      createDailyPriceQueryRepository(),
      result.companies.map((company) => company.stockCode),
      "1M",
    );
  } catch (error) {
    message = error instanceof InvalidInputError || error instanceof DataAccessError
      ? error.message
      : "검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }

  const makeHref = (page: number) => {
    const query = new URLSearchParams();
    if (rawQuery) query.set("query", rawQuery);
    if (selectedCategory) query.set("category", selectedCategory);
    if (page > 1) query.set("page", String(page));
    const suffix = query.toString();
    return suffix ? `/search?${suffix}` : "/search";
  };

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>기업 검색</span></div>
        <section className="page-intro">
          <p className="eyebrow">기업 찾기</p>
          <h1>{rawQuery ? "기업 검색" : "기업 둘러보기"}</h1>
          <p>전체 상장기업을 둘러보거나 회사명·6자리 종목코드로 빠르게 찾을 수 있습니다.</p>
          <CompanySearchForm initialQuery={rawQuery} category={selectedCategory} autoFocus />
        </section>

        <CompanyCategoryFilter query={rawQuery} selectedCategory={selectedCategory} />

        <section aria-live="polite" aria-labelledby="result-heading">
          <div className="result-heading">
            <h2 id="result-heading">
              {message
                ? "검색 안내"
                : rawQuery
                  ? `“${rawQuery}”${selectedCategoryLabel ? ` · ${selectedCategoryLabel}` : ""} 검색 결과`
                  : `${selectedCategoryLabel ?? "전체 업종"} 기업`}
            </h2>
            {!message && <span>총 {result.total.toLocaleString("ko-KR")}개</span>}
          </div>
          {message ? (
            <div className="empty-state"><strong>{message}</strong><p>기업명 또는 정확한 종목코드를 확인해 주세요.</p></div>
          ) : result.companies.length > 0 ? (
            <>
            <div className="result-list">
              {result.companies.map((company) => (
                <CompanyResultCard
                  company={company}
                  key={company.stockCode}
                  snapshot={priceSnapshots[company.stockCode]!}
                />
              ))}
            </div>
            {result.totalPages > 1 && (
              <nav className="pagination" aria-label="기업 페이지 이동">
                {result.page > 1 ? <Link href={makeHref(result.page - 1)}>← 이전</Link> : <span aria-disabled="true">← 이전</span>}
                <strong>{result.page} / {result.totalPages}</strong>
                {result.page < result.totalPages ? <Link href={makeHref(result.page + 1)}>다음 →</Link> : <span aria-disabled="true">다음 →</span>}
              </nav>
            )}
            </>
          ) : (
            <div className="empty-state">
              <strong>일치하는 기업을 찾지 못했습니다.</strong>
              <p>검색어를 바꾸거나 다른 업종 카테고리를 선택해 보세요.</p>
              <Link className="primary-link" href="/search">전체 기업 보기</Link>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

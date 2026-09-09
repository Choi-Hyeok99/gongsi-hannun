import type { Metadata } from "next";
import Link from "next/link";
import { CompanyCategoryFilter } from "@/components/CompanyCategoryFilter";
import { CompanyResultCard } from "@/components/CompanyResultCard";
import { CompanySearchForm } from "@/components/CompanySearchForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createCompanyRepository } from "@/data/supabase-company-repository";
import { COMPANY_INDUSTRY_CATEGORIES, COMPANY_INDUSTRY_CATEGORY_LABELS } from "@/domain/company";
import { DataAccessError, InvalidInputError } from "@/domain/errors";
import { searchCompanies, type PublicCompany } from "@/server/company-use-cases";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "기업 검색 | 공시한눈",
  description: "기업명이나 종목코드로 상장기업을 검색합니다.",
};

type Props = Readonly<{
  searchParams: Promise<{ query?: string | string[]; category?: string | string[] }>;
}>;

export default async function SearchPage({ searchParams }: Props) {
  const parameters = await searchParams;
  const rawQuery = typeof parameters.query === "string" ? parameters.query : "";
  const rawCategory = typeof parameters.category === "string" ? parameters.category : "";
  const selectedCategory = COMPANY_INDUSTRY_CATEGORIES.find((category) => category === rawCategory);
  const selectedCategoryLabel = selectedCategory ? COMPANY_INDUSTRY_CATEGORY_LABELS[selectedCategory] : null;
  let companies: PublicCompany[] = [];
  let message: string | null = null;

  try {
    companies = [...await searchCompanies(createCompanyRepository(), rawQuery, rawCategory)];
  } catch (error) {
    message = error instanceof InvalidInputError || error instanceof DataAccessError
      ? error.message
      : "검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>기업 검색</span></div>
        <section className="page-intro">
          <p className="eyebrow">기업 찾기</p>
          <h1>기업 검색</h1>
          <p>회사명 앞부분 또는 6자리 종목코드를 입력해 주세요.</p>
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
            {!message && <span>{companies.length}개</span>}
          </div>
          {message ? (
            <div className="empty-state"><strong>{message}</strong><p>기업명 또는 정확한 종목코드를 확인해 주세요.</p></div>
          ) : companies.length > 0 ? (
            <div className="result-list">
              {companies.map((company) => <CompanyResultCard company={company} key={company.stockCode} />)}
            </div>
          ) : (
            <div className="empty-state">
              <strong>일치하는 기업을 찾지 못했습니다.</strong>
              <p>검색어를 바꾸거나 다른 업종 카테고리를 선택해 보세요.</p>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

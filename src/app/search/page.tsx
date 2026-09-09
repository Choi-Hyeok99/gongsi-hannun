import type { Metadata } from "next";
import Link from "next/link";
import { CompanyResultCard } from "@/components/CompanyResultCard";
import { CompanySearchForm } from "@/components/CompanySearchForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createCompanyRepository } from "@/data/supabase-company-repository";
import { DataAccessError, InvalidInputError } from "@/domain/errors";
import { searchCompanies, type PublicCompany } from "@/server/company-use-cases";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "기업 검색 | 공시한눈",
  description: "기업명이나 종목코드로 상장기업을 검색합니다.",
};

type Props = Readonly<{
  searchParams: Promise<{ query?: string | string[] }>;
}>;

export default async function SearchPage({ searchParams }: Props) {
  const parameters = await searchParams;
  const rawQuery = typeof parameters.query === "string" ? parameters.query : "";
  let companies: PublicCompany[] = [];
  let message: string | null = null;

  try {
    companies = [...await searchCompanies(createCompanyRepository(), rawQuery)];
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
          <CompanySearchForm initialQuery={rawQuery} autoFocus />
        </section>

        <section aria-live="polite" aria-labelledby="result-heading">
          <div className="result-heading">
            <h2 id="result-heading">{message ? "검색 안내" : `“${rawQuery}” 검색 결과`}</h2>
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
              <p>띄어쓰기를 줄이거나 6자리 종목코드로 다시 검색해 보세요.</p>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

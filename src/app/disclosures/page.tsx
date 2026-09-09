import type { Metadata } from "next";
import Link from "next/link";
import { DisclosureList } from "@/components/DisclosureList";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createDisclosureRepository } from "@/data/supabase-disclosure-repository";
import { searchDisclosures } from "@/server/disclosure-use-cases";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "오늘의 주요 공시 | 공시한눈",
  description: "OpenDART에서 수집한 최신 상장기업 공시를 날짜순으로 확인합니다.",
};

type Props = Readonly<{
  searchParams: Promise<{ date?: string; page?: string }>;
}>;

export default async function DisclosuresPage({ searchParams }: Props) {
  const params = await searchParams;
  const result = await searchDisclosures(
    createDisclosureRepository(),
    params.date ?? null,
    params.page ?? null,
  );
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  const makeHref = (page: number) => {
    const query = new URLSearchParams();
    if (result.date) query.set("date", result.date);
    if (page > 1) query.set("page", String(page));
    const value = query.toString();
    return value ? `/disclosures?${value}` : "/disclosures";
  };

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>오늘의 주요 공시</span></div>
        <section className="page-intro">
          <p className="eyebrow">OpenDART 최신 정보</p>
          <h1>오늘의 주요 공시</h1>
          <p>실제 공시일 기준으로 날짜를 선택하거나 과거 공시까지 이동할 수 있습니다.</p>
        </section>
        <form className="disclosure-filter" action="/disclosures" method="get">
          <label htmlFor="disclosure-date">공시일 선택</label>
          <input id="disclosure-date" name="date" type="date" defaultValue={result.date ?? ""} />
          <button type="submit">조회</button>
          {result.date ? <Link href="/disclosures">전체 날짜</Link> : null}
        </form>
        <section aria-labelledby="latest-disclosures-heading">
          <div className="result-heading">
            <h2 id="latest-disclosures-heading">{result.date ? `${result.date} 공시` : "전체 공시"}</h2>
            <span>총 {result.totalCount.toLocaleString("ko-KR")}건</span>
          </div>
          <DisclosureList disclosures={result.items} />
          {result.totalCount > result.pageSize ? (
            <nav className="pagination" aria-label="공시 페이지 이동">
              {result.page > 1 ? <Link href={makeHref(result.page - 1)}>← 이전</Link> : <span aria-disabled="true">← 이전</span>}
              <strong>{result.page} / {totalPages}</strong>
              {result.page < totalPages ? <Link href={makeHref(result.page + 1)}>다음 →</Link> : <span aria-disabled="true">다음 →</span>}
            </nav>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

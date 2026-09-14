import type { Metadata } from "next";
import Link from "next/link";
import { DisclosureList } from "@/components/DisclosureList";
import { ListPositionMemory } from "@/components/ListPositionMemory";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createDisclosureRepository } from "@/data/supabase-disclosure-repository";
import { DISCLOSURE_EVENT_TYPES, getDisclosureEventTypeLabel } from "@/domain/disclosure-classification";
import type { DisclosureSearchResult } from "@/domain/disclosure-query";
import { searchDisclosures } from "@/server/disclosure-use-cases";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "최근 주요 공시 | 공시한눈",
  description: "OpenDART에서 수집한 최신 상장기업 공시를 날짜순으로 확인합니다.",
};

type Props = Readonly<{
  searchParams: Promise<{ date?: string; page?: string; type?: string; q?: string }>;
}>;

const PUBLIC_EVENT_TYPES = DISCLOSURE_EVENT_TYPES.filter((eventType) => eventType !== "OTHER");
type PublicDisclosurePage = DisclosureSearchResult & { date: string | null; eventType: (typeof DISCLOSURE_EVENT_TYPES)[number] | null; term: string | null; page: number; pageSize: number };
const EMPTY_RESULT: PublicDisclosurePage = { items: [], totalCount: 0, date: null, eventType: null, term: null, page: 1, pageSize: 30 };

export default async function DisclosuresPage({ searchParams }: Props) {
  const params = await searchParams;
  const resultState = await Promise.resolve()
    .then(() => searchDisclosures(
      createDisclosureRepository(),
      params.date ?? null,
      params.page ?? null,
      params.type ?? null,
      params.q ?? null,
    ))
    .then((result) => ({ result, failed: false as const }))
    .catch(() => ({ result: EMPTY_RESULT, failed: true as const }));
  const { result } = resultState;
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  const makeHref = (page: number) => {
    const query = new URLSearchParams();
    if (result.date) query.set("date", result.date);
    if (result.eventType) query.set("type", result.eventType);
    if (result.term) query.set("q", result.term);
    if (page > 1) query.set("page", String(page));
    const value = query.toString();
    return value ? `/disclosures?${value}` : "/disclosures";
  };

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <ListPositionMemory />
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>최근 주요 공시</span></div>
        <section className="page-intro">
          <p className="eyebrow">OpenDART 최신 정보</p>
          <h1>최근 주요 공시</h1>
          <p>실제 공시일 기준으로 날짜를 선택하거나 과거 공시까지 이동할 수 있습니다.</p>
          <Link className="text-link" href="/calendar">달력으로 보기 →</Link>
        </section>
        <form className="disclosure-filter" action="/disclosures" method="get">
          <label htmlFor="disclosure-query">검색</label>
          <input
            id="disclosure-query"
            name="q"
            type="search"
            placeholder="공시 제목 또는 기업명"
            defaultValue={result.term ?? ""}
          />
          <label htmlFor="disclosure-type">유형</label>
          <select id="disclosure-type" name="type" defaultValue={result.eventType ?? ""}>
            <option value="">전체 유형</option>
            {PUBLIC_EVENT_TYPES.map((eventType) => (
              <option key={eventType} value={eventType}>{getDisclosureEventTypeLabel(eventType)}</option>
            ))}
          </select>
          <label htmlFor="disclosure-date">공시일</label>
          <input id="disclosure-date" name="date" type="date" defaultValue={result.date ?? ""} />
          <button type="submit">조회</button>
          {result.date || result.eventType || result.term ? <Link href="/disclosures">조건 초기화</Link> : null}
        </form>
        <section aria-labelledby="latest-disclosures-heading">
          <div className="result-heading">
            <h2 id="latest-disclosures-heading">{result.date ? `${result.date} 공시` : "전체 공시"}</h2>
            <span>총 {result.totalCount.toLocaleString("ko-KR")}건</span>
          </div>
          <DisclosureList
            disclosures={result.items}
            emptyState={resultState.failed ? {
              title: "공시 목록을 불러오지 못했습니다.",
              description: "데이터 연결 상태를 확인한 뒤 다시 시도해 주세요.",
              action: { href: "/disclosures", label: "공시 목록 다시 보기" },
            } : {
              title: "검색 조건에 맞는 공개 공시가 없습니다.",
              description: "검색어·공시 유형·날짜 조건을 바꾸거나 초기화해 주세요.",
              action: { href: "/disclosures", label: "검색 조건 초기화" },
            }}
          />
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

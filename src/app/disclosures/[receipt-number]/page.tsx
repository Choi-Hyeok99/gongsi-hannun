import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createDisclosureRepository } from "@/data/supabase-disclosure-repository";
import { getDisclosure } from "@/server/disclosure-use-cases";

export const dynamic = "force-dynamic";

type Props = Readonly<{
  params: Promise<{ "receipt-number": string }>;
}>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { "receipt-number": receiptNumber } = await params;
  const disclosure = await getDisclosure(createDisclosureRepository(), receiptNumber);
  return {
    title: disclosure ? `${disclosure.reportName} | 공시한눈` : "공시 상세 | 공시한눈",
    description: disclosure ? `${disclosure.company.name}의 ${disclosure.reportName} 공시입니다.` : "공시 상세 정보를 확인합니다.",
  };
}

export default async function DisclosureDetailPage({ params }: Props) {
  const { "receipt-number": receiptNumber } = await params;
  const disclosure = await getDisclosure(createDisclosureRepository(), receiptNumber);

  if (!disclosure) {
    return (
      <div className="site-shell">
        <SiteHeader />
        <main className="content-container page-content">
          <div className="empty-state empty-state--page">
            <strong>공시 정보를 찾지 못했습니다.</strong>
            <p>접수번호를 확인하거나 최신 공시 목록을 이용해 주세요.</p>
            <Link className="primary-link" href="/disclosures">최신 공시로 이동</Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <div className="breadcrumb">
          <Link href="/">홈</Link><span>/</span><Link href="/disclosures">오늘의 주요 공시</Link><span>/</span><span>상세</span>
        </div>
        <article className="disclosure-detail">
          <div className="disclosure-detail__heading">
            <p className="eyebrow">공시 상세</p>
            <h1>{disclosure.reportName}</h1>
            <Link href={`/companies/${disclosure.company.stockCode}`}>{disclosure.company.name} · {disclosure.company.market}</Link>
          </div>
          <dl className="company-facts">
            <div><dt>공시일</dt><dd>{disclosure.disclosedOn}</dd></div>
            <div><dt>제출인</dt><dd>{disclosure.filerName ?? disclosure.company.name}</dd></div>
            <div><dt>접수번호</dt><dd>{disclosure.receiptNumber}</dd></div>
            <div><dt>상태</dt><dd>{disclosure.status === "REVIEW_REQUIRED" ? "정정 여부 확인 필요" : "정상"}</dd></div>
          </dl>
          <a className="primary-link disclosure-detail__source" href={disclosure.originalUrl} target="_blank" rel="noopener noreferrer">
            OpenDART 원문 보기
          </a>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

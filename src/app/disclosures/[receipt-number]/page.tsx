import type { Metadata } from "next";
import Link from "next/link";
import { AiDisclosureSummaryPreview } from "@/components/AiDisclosureSummaryPreview";
import { EasyDisclosureTitle } from "@/components/EasyDisclosureTitle";
import { DisclosureDocumentList } from "@/components/DisclosureDocumentList";
import { ReturnToListButton } from "@/components/ReturnToListButton";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { findAiDisclosureSummaryState } from "@/data/server-ai-analysis-repository";
import { createDisclosureDocumentRepository } from "@/data/supabase-disclosure-document-repository";
import { createDisclosureRepository } from "@/data/supabase-disclosure-repository";
import { getDisclosureEventTypeLabel } from "@/domain/disclosure-classification";
import { getDisclosureDocumentCollectionStatus, listDisclosureDocuments } from "@/server/disclosure-document-use-cases";
import { findCorrectionTimeline, getDisclosure, listCompanyDisclosures } from "@/server/disclosure-use-cases";

export const dynamic = "force-dynamic";

type Props = Readonly<{
  params: Promise<{ "receipt-number": string }>;
}>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { "receipt-number": receiptNumber } = await params;
  const repository = createDisclosureRepository();
  const disclosure = await getDisclosure(repository, receiptNumber);
  return {
    title: disclosure ? `${disclosure.reportName} | 공시한눈` : "공시 상세 | 공시한눈",
    description: disclosure ? `${disclosure.company.name}의 ${disclosure.reportName} 공시입니다.` : "공시 상세 정보를 확인합니다.",
  };
}

export default async function DisclosureDetailPage({ params }: Props) {
  const { "receipt-number": receiptNumber } = await params;
  const repository = createDisclosureRepository();
  const disclosure = await getDisclosure(repository, receiptNumber);

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

  const documentRepository = createDisclosureDocumentRepository();
  const [companyDisclosures, documents, documentStatus, aiSummaryState] = await Promise.all([
    listCompanyDisclosures(repository, disclosure.company.stockCode, 30),
    listDisclosureDocuments(documentRepository, disclosure.receiptNumber),
    getDisclosureDocumentCollectionStatus(documentRepository, disclosure.receiptNumber),
    findAiDisclosureSummaryState(disclosure.receiptNumber).catch(() => ({ status: "FAILED", summary: null } as const)),
  ]);
  const correctionTimeline = findCorrectionTimeline(disclosure, companyDisclosures);

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
            <EasyDisclosureTitle text={disclosure.reportName} />
            <Link href={`/companies/${disclosure.company.stockCode}`}>{disclosure.company.name} · {disclosure.company.market}</Link>
          </div>
          <dl className="company-facts">
            <div><dt>공시 유형</dt><dd>{getDisclosureEventTypeLabel(disclosure.eventType)}</dd></div>
            <div><dt>공시일</dt><dd>{disclosure.disclosedOn}</dd></div>
            <div><dt>제출인</dt><dd>{disclosure.filerName ?? disclosure.company.name}</dd></div>
            <div><dt>접수번호</dt><dd>{disclosure.receiptNumber}</dd></div>
            <div><dt>상태</dt><dd>{getStatusLabel(disclosure.status)}</dd></div>
          </dl>
          <AiDisclosureSummaryPreview
            companyName={disclosure.company.name}
            reportName={disclosure.reportName}
            disclosedOn={disclosure.disclosedOn}
            eventTypeLabel={getDisclosureEventTypeLabel(disclosure.eventType)}
            originalUrl={disclosure.originalUrl}
            state={aiSummaryState}
          />
          <DisclosureDocumentList receiptNumber={disclosure.receiptNumber} documents={documents} status={documentStatus} />
          {correctionTimeline.length > 1 && (
            <section className="correction-timeline" aria-labelledby="correction-heading">
              <div><p className="eyebrow">최신본 확인</p><h2 id="correction-heading">정정공시 흐름</h2></div>
              <p>같은 제목의 공시를 날짜순으로 연결했습니다. 가장 최근 공시와 원문을 확인해 주세요.</p>
              <ol>{correctionTimeline.map((item, index) => <li key={item.receiptNumber}><Link aria-current={item.receiptNumber === disclosure.receiptNumber ? "page" : undefined} href={`/disclosures/${item.receiptNumber}`}><span>{index === 0 ? "최초" : `${index + 1}차`}</span><strong>{item.disclosedOn}</strong><small>{item.receiptNumber === disclosure.receiptNumber ? "현재 보고 있는 공시" : item.reportName}</small></Link></li>)}</ol>
            </section>
          )}
          <div className="disclosure-detail__actions">
            <a className="primary-link" href={disclosure.originalUrl} target="_blank" rel="noopener noreferrer">OpenDART 원문 보기</a>
            <ReturnToListButton />
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

function getStatusLabel(status: "ACTIVE" | "CORRECTED" | "CANCELLED" | "REVIEW_REQUIRED"): string {
  if (status === "CORRECTED") return "정정된 이전 공시";
  if (status === "CANCELLED") return "취소된 공시";
  if (status === "REVIEW_REQUIRED") return "정정 여부 확인 필요";
  return "정상";
}

import type { Metadata } from "next";
import Link from "next/link";
import { DocumentReaderTools } from "@/components/DocumentReaderTools";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createDisclosureDocumentRepository } from "@/data/supabase-disclosure-document-repository";
import { getDisclosureDocument } from "@/server/disclosure-document-use-cases";

export const dynamic = "force-dynamic";

type Props = Readonly<{
  params: Promise<{ "receipt-number": string; "document-id": string }>;
}>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const values = await params;
  const document = await getDisclosureDocument(
    createDisclosureDocumentRepository(),
    values["receipt-number"],
    values["document-id"],
  );
  return {
    title: document ? `${document.title} | 공시한눈` : "공시 문서 | 공시한눈",
    description: document ? `${document.companyName} 공시의 제출 문서입니다.` : "공시 제출 문서를 확인합니다.",
  };
}

export default async function DisclosureDocumentPage({ params }: Props) {
  const values = await params;
  const document = await getDisclosureDocument(
    createDisclosureDocumentRepository(),
    values["receipt-number"],
    values["document-id"],
  );
  const disclosureUrl = `/disclosures/${values["receipt-number"]}`;

  if (!document) {
    return (
      <div className="site-shell">
        <SiteHeader />
        <main className="content-container page-content">
          <div className="empty-state empty-state--page">
            <strong>문서를 찾지 못했습니다.</strong>
            <p>공시 상세에서 제출 문서를 다시 선택해 주세요.</p>
            <Link className="primary-link" href={disclosureUrl}>공시 상세로 돌아가기</Link>
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
          <Link href="/">홈</Link><span>/</span><Link href="/disclosures">오늘의 주요 공시</Link><span>/</span><Link href={disclosureUrl}>상세</Link><span>/</span><span>문서</span>
        </div>
        <article className="document-reader" id="disclosure-document-reader">
          <header className="document-reader__heading">
            <div className="document-reader__badges">
              <span className={`document-kind document-kind--${document.kind.toLowerCase()}`}>{document.kind === "MAIN" ? "본문" : "첨부"}</span>
              <span>{document.companyName}</span>
            </div>
            <h1>{document.title}</h1>
            <p>{document.reportName}</p>
          </header>
          <DocumentReaderTools storageKey={`${document.receiptNumber}:${document.id}`} />
          {document.isTruncated ? <p className="document-reader__notice">문서가 길어 일부 내용만 표시합니다. 전체 내용은 OpenDART 원문에서 확인해 주세요.</p> : null}
          <div className="document-reader__content">
            {document.contentText || "표시할 수 있는 텍스트가 없습니다. OpenDART 원문을 확인해 주세요."}
          </div>
          <div className="disclosure-detail__actions">
            <Link className="primary-link" href={disclosureUrl}>공시 상세로 돌아가기</Link>
            <a className="secondary-link" href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${document.receiptNumber}`} target="_blank" rel="noopener noreferrer">OpenDART 전체 원문</a>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

import Link from "next/link";
import React from "react";
import type {
  DisclosureDocumentCollectionStatus,
  DisclosureDocumentSummary,
} from "@/domain/disclosure-document";

type Props = Readonly<{
  receiptNumber: string;
  documents: readonly DisclosureDocumentSummary[];
  status?: DisclosureDocumentCollectionStatus;
}>;

export function DisclosureDocumentList({ receiptNumber, documents, status }: Props) {
  const mainDocument = documents.find((document) => document.kind === "MAIN") ?? documents[0];
  const attachments = documents.filter((document) => document.id !== mainDocument?.id);

  return (
    <section className="filing-documents" aria-labelledby="filing-documents-heading">
      <div className="filing-documents__heading">
        <div><p className="eyebrow">제출 문서</p><h2 id="filing-documents-heading">본문과 첨부문서</h2></div>
        {documents.length > 0 ? <strong>{documents.length}개</strong> : null}
      </div>
      {mainDocument ? (
        <>
          <DocumentItems receiptNumber={receiptNumber} documents={[mainDocument]} />
          {attachments.length > 0 ? (
            <details className="filing-attachments">
              <summary><span>첨부문서 <strong>{attachments.length}개</strong></span><span>펼쳐보기</span></summary>
              <DocumentItems receiptNumber={receiptNumber} documents={attachments} />
            </details>
          ) : null}
        </>
      ) : (
        <div className="filing-documents__empty" role="status">
          <strong>{getStatusTitle(status)}</strong>
          <p>{getStatusDescription(status)}</p>
        </div>
      )}
    </section>
  );
}

function DocumentItems({ receiptNumber, documents }: Readonly<{ receiptNumber: string; documents: readonly DisclosureDocumentSummary[] }>) {
  return (
    <ol className="filing-document-list">
      {documents.map((document) => (
        <li key={document.id}>
          <Link href={`/disclosures/${receiptNumber}/documents/${document.id}`}>
            <span className={`document-kind document-kind--${document.kind.toLowerCase()}`}>
              {document.kind === "MAIN" ? "본문" : "첨부"}
            </span>
            <span><strong>{document.title}</strong><small>{formatBytes(document.byteSize)}{document.isTruncated ? " · 긴 문서" : ""}</small></span>
            <span aria-hidden="true">보기</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function getStatusTitle(status?: DisclosureDocumentCollectionStatus): string {
  if (status === "FETCHING") return "원문을 받고 있습니다";
  if (status === "FAILED") return "원문 수집이 잠시 지연되고 있습니다";
  if (status === "UNAVAILABLE") return "제공된 원문 파일이 없습니다";
  if (status === "READY") return "표시 가능한 문서가 없습니다";
  return "원문 수집을 기다리고 있습니다";
}

function getStatusDescription(status?: DisclosureDocumentCollectionStatus): string {
  if (status === "FAILED") return "다음 자동 수집 때 다시 시도합니다. 지금은 아래 OpenDART 원문을 확인해 주세요.";
  if (status === "UNAVAILABLE") return "일부 공시는 OpenDART 원본파일 API에서 별도 문서를 제공하지 않습니다.";
  if (status === "READY") return "안전하게 변환할 수 있는 텍스트 문서가 없어 OpenDART 원문으로 연결합니다.";
  return "준비가 끝나면 이곳에 본문과 첨부문서가 표시됩니다.";
}

function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${Math.ceil(value / 1_024)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

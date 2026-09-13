import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DisclosureDocumentList } from "@/components/DisclosureDocumentList";
import { DocumentReaderTools } from "@/components/DocumentReaderTools";
import type { DisclosureDocumentSummary } from "@/domain/disclosure-document";

const documents: readonly DisclosureDocumentSummary[] = [
  { id: "main", sequenceNumber: 1, kind: "MAIN", title: "사업보고서", fileName: "main.xml", mimeType: "application/xml", byteSize: 2_048, isTruncated: false },
  { id: "audit", sequenceNumber: 2, kind: "ATTACHMENT", title: "감사보고서", fileName: "audit.xml", mimeType: "application/xml", byteSize: 4_096, isTruncated: false },
];

describe("DisclosureDocumentList", () => {
  it("shows the main document first and keeps attachments collapsed", () => {
    const markup = renderToStaticMarkup(<DisclosureDocumentList receiptNumber="20260909000001" documents={documents} status="READY" />);
    expect(markup).toContain("사업보고서");
    expect(markup).toContain("첨부문서 <strong>1개</strong>");
    expect(markup).toContain("<details");
  });

  it("explains a failed collection without exposing an internal error", () => {
    const markup = renderToStaticMarkup(<DisclosureDocumentList receiptNumber="20260909000001" documents={[]} status="FAILED" />);
    expect(markup).toContain("원문 수집이 잠시 지연되고 있습니다");
    expect(markup).toContain("자동 수집 때 다시 시도");
  });
});

describe("DocumentReaderTools", () => {
  it("starts with only the essential reading controls", () => {
    const markup = renderToStaticMarkup(<DocumentReaderTools storageKey="receipt:document" />);
    expect(markup).toContain("문서 검색");
    expect(markup).toContain("읽기 설정");
    expect(markup).not.toContain("reader-settings\" hidden");
  });
});


import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiDisclosureSummaryPreview } from "@/components/AiDisclosureSummaryPreview";

describe("AiDisclosureSummaryPreview", () => {
  const baseProps = {
    companyName: "삼성전자",
    reportName: "사업보고서",
    disclosedOn: "2026-09-10",
    eventTypeLabel: "정기보고",
    originalUrl: "https://dart.fss.or.kr/example",
    receiptNumber: "20260910000001",
  };

  it.each([
    [{ status: "NOT_GENERATED", summary: null } as const, "요약 대기", "AI 요약을 순차적으로 준비합니다."],
    [{ status: "PENDING", summary: null, updatedAt: "2026-09-14T03:20:00Z" } as const, "준비 예정", "AI 해설을 준비하고 있습니다."],
    [{ status: "PROCESSING", summary: null, updatedAt: "2026-09-14T03:20:00Z" } as const, "해설 작성 중", "공시 내용을 확인하고 있습니다."],
    [{ status: "FAILED", summary: null, updatedAt: "2026-09-14T03:20:00Z" } as const, "준비 지연", "AI 해설 준비가 지연되고 있습니다."],
    [{ status: "UNAVAILABLE", summary: null, updatedAt: null } as const, "상태 확인 지연", "AI 해설 상태를 불러오지 못했습니다."],
  ])("shows only the factual status and source CTA", (state, badge, title) => {
    const markup = renderToStaticMarkup(<AiDisclosureSummaryPreview {...baseProps} state={state} />);

    expect(markup).toContain("AI 공시 해설");
    expect(markup).toContain(badge);
    expect(markup).toContain(title);
    expect(markup).toContain('href="https://dart.fss.or.kr/example"');
    expect(markup).not.toContain("실제 핵심 요약입니다.");
  });

  it("explains that a delayed AI explanation does not mean the disclosure data failed", () => {
    const markup = renderToStaticMarkup(<AiDisclosureSummaryPreview {...baseProps} state={{ status: "FAILED", summary: null, updatedAt: "2026-09-14T03:20:00Z" }} />);

    expect(markup).toContain("공시 데이터의 오류가 아닙니다.");
    expect(markup).toContain("원문과 제출 문서는 정상적으로 확인할 수 있으며");
    expect(markup).not.toContain("분석 실패");
  });

  it("does not present an AI status lookup outage as an analysis failure", () => {
    const markup = renderToStaticMarkup(<AiDisclosureSummaryPreview {...baseProps} state={{ status: "UNAVAILABLE", summary: null, updatedAt: null }} />);

    expect(markup).toContain("AI 분석 실패를 의미하지 않습니다.");
    expect(markup).not.toContain("AI 해설 준비가 지연되고 있습니다.");
  });

  it("explains when the source document must be collected before AI analysis", () => {
    const markup = renderToStaticMarkup(<AiDisclosureSummaryPreview {...baseProps} documentStatus="PENDING" state={{ status: "NOT_GENERATED", summary: null }} />);
    expect(markup).toContain("원문 수집 중");
    expect(markup).toContain("제출 문서를 수집하고 있습니다");
    expect(markup).not.toContain("AI 해설은 아직 준비되지 않았습니다");
  });

  it("renders a complete report entirely from a stored successful analysis", () => {
    const summary = {
      plainSummary: "실제 핵심 요약입니다.",
      whyItMatters: "실제 중요 이유입니다.",
      checkpoints: ["매출 수치 확인"],
      cautions: ["정정공시 여부 확인"],
      importanceScore: 82,
      generatedAt: "2026-09-11T00:00:00Z",
      verifiedFacts: [{
        kind: "AMOUNT" as const,
        label: "계약금액",
        value: "100",
        unit: "억원",
        sourceQuote: "계약금액은 100 억원입니다.",
        verificationStatus: "VERIFIED" as const,
        source: {
          documentId: "document-1",
          documentTitle: "주요사항보고서",
          documentKind: "MAIN" as const,
          contentHash: "a".repeat(64),
          startOffset: 10,
          endOffset: 30,
        },
      }],
    };
    const markup = renderToStaticMarkup(
      <AiDisclosureSummaryPreview {...baseProps} state={{ status: "READY", summary }} />,
    );

    for (const text of ["실제 핵심 요약입니다.", "실제 중요 이유입니다.", "매출 수치 확인", "정정공시 여부 확인", "중요도 82/100", "계약금액", "100 억원", "분석 완료"]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain("AI 심층 리포트");
    expect(markup).toContain('/disclosures/20260910000001/documents/document-1');
    expect(markup).toContain('href="#filing-documents"');
    expect(markup).toContain("생성형 AI가 공시 원문을 바탕으로 작성했습니다");
    expect(markup).toContain("오류가 있을 수 있습니다");
    expect(markup).not.toContain("aria-roledescription=\"carousel\"");
    expectNoFabricatedAnalysis(markup);
  });

  it("shows a compact summary for a lower-importance completed analysis", () => {
    const summary = { plainSummary: "실제 요약", whyItMatters: "중요 이유", checkpoints: [], cautions: [], importanceScore: 40, generatedAt: "2026-09-11T00:00:00Z", verifiedFacts: [] };
    const markup = renderToStaticMarkup(<AiDisclosureSummaryPreview {...baseProps} state={{ status: "READY", summary }} />);
    expect(markup).toContain("AI 핵심 요약");
    expect(markup).toContain("요약 완료");
    expect(markup).toContain("실제 요약");
    expect(markup).toContain("중요 이유");
    expect(markup).toContain("수집된 문서 보기");
    expect(markup).not.toContain("투자자 확인 항목");
  });
});

function expectNoFabricatedAnalysis(markup: string): void {
  for (const text of ["예시 화면", "구성 예시", "기회 요인", "위험 요인", "비교 예정", "원문 분석 후 표시", "비교 데이터 준비 중"]) {
    expect(markup).not.toContain(text);
  }
}

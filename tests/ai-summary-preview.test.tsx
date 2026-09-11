import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiDisclosureSummaryPreview } from "@/components/AiDisclosureSummaryPreview";

describe("AiDisclosureSummaryPreview", () => {
  it("clearly labels sample content and exposes accessible carousel controls", () => {
    const markup = renderToStaticMarkup(
      <AiDisclosureSummaryPreview companyName="삼성전자" reportName="사업보고서" disclosedOn="2026-09-10" eventTypeLabel="정기보고" />,
    );

    expect(markup).toContain("AI 공시 요약");
    expect(markup).toContain("예시 화면");
    expect(markup).toContain("삼성전자 · 정기보고");
    expect(markup).toContain("공시명: 사업보고서");
    expect(markup).toContain("aria-roledescription=\"carousel\"");
    expect(markup).toContain("aria-label=\"이전 요약\"");
    expect(markup).toContain("aria-label=\"다음 요약\"");
  });

  it("shows a stored AI summary without the sample label", () => {
    const markup = renderToStaticMarkup(
      <AiDisclosureSummaryPreview
        companyName="삼성전자"
        reportName="사업보고서"
        disclosedOn="2026-09-10"
        eventTypeLabel="정기보고"
        summary={{ plainSummary: "실제 핵심 요약입니다.", whyItMatters: "실제 중요 이유입니다.", checkpoints: ["수치 확인"], cautions: ["원문 확인"], importanceScore: 80, generatedAt: "2026-09-11T00:00:00Z" }}
      />,
    );
    expect(markup).toContain("AI 생성");
    expect(markup).toContain("실제 핵심 요약입니다.");
    expect(markup).not.toContain("예시 화면");
  });
});

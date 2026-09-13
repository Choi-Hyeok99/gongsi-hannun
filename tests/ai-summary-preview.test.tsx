import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiDisclosureSummaryPreview, createSummarySlides } from "@/components/AiDisclosureSummaryPreview";

describe("AiDisclosureSummaryPreview", () => {
  const baseProps = {
    companyName: "삼성전자",
    reportName: "사업보고서",
    disclosedOn: "2026-09-10",
    eventTypeLabel: "정기보고",
    originalUrl: "https://dart.fss.or.kr/example",
  };

  it.each([
    ["NOT_GENERATED", "분석 미생성", "AI 요약이 아직 생성되지 않았습니다."],
    ["PENDING", "분석 대기", "AI 요약을 준비하고 있습니다."],
    ["FAILED", "분석 확인 불가", "AI 요약을 표시할 수 없습니다."],
  ] as const)("shows only the factual %s state and the source CTA", (status, badge, title) => {
    const markup = renderToStaticMarkup(
      <AiDisclosureSummaryPreview {...baseProps} state={{ status, summary: null }} />,
    );

    expect(markup).toContain("AI 공시 분석");
    expect(markup).toContain(badge);
    expect(markup).toContain(title);
    expect(markup).toContain('href="https://dart.fss.or.kr/example"');
    expect(markup).not.toContain("aria-roledescription=\"carousel\"");
    expectNoFabricatedAnalysis(markup);
  });

  it("shows a stored successful AI summary without a deep-report preview", () => {
    const summary = { plainSummary: "실제 핵심 요약입니다.", whyItMatters: "실제 중요 이유입니다.", checkpoints: ["수치 확인"], cautions: ["원문 확인"], importanceScore: 80, generatedAt: "2026-09-11T00:00:00Z" };
    const markup = renderToStaticMarkup(
      <AiDisclosureSummaryPreview
        {...baseProps}
        state={{ status: "READY", summary }}
      />,
    );
    const slides = createSummarySlides(baseProps, summary);
    expect(markup).toContain("AI 생성");
    expect(markup).toContain("실제 핵심 요약입니다.");
    expect(slides[1]?.items).toEqual(["실제 중요 이유입니다.", "수치 확인"]);
    expect(slides[2]?.items).toEqual(["원문 확인"]);
    expect(markup).toContain("aria-roledescription=\"carousel\"");
    expect(markup).toContain("aria-label=\"이전 요약\"");
    expect(markup).toContain("aria-label=\"다음 요약\"");
    expectNoFabricatedAnalysis(markup);
  });
});

function expectNoFabricatedAnalysis(markup: string): void {
  for (const text of ["예시 화면", "심층 리포트", "기회 요인", "위험 요인", "핵심 숫자 변화", "원문 분석 후 표시", "비교 데이터 준비 중"]) {
    expect(markup).not.toContain(text);
  }
}

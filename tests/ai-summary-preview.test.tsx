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
    expect(markup).toContain("삼성전자의 사업보고서 공시입니다.");
    expect(markup).toContain("aria-roledescription=\"carousel\"");
    expect(markup).toContain("aria-label=\"이전 요약\"");
    expect(markup).toContain("aria-label=\"다음 요약\"");
  });
});

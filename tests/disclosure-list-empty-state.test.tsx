import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DisclosureList } from "@/components/DisclosureList";

describe("DisclosureList empty states", () => {
  it("uses a factual default for a database with no public disclosures", () => {
    const markup = renderToStaticMarkup(<DisclosureList disclosures={[]} />);
    expect(markup).toContain("현재 표시할 공개 공시가 없습니다.");
    expect(markup).toContain("수집이 완료된 공개 공시가 생기면");
  });

  it("renders the caller-provided cause and recovery action", () => {
    const markup = renderToStaticMarkup(<DisclosureList disclosures={[]} emptyState={{
      title: "검색 결과 없음",
      description: "조건을 변경해 주세요.",
      action: { href: "/disclosures", label: "조건 초기화" },
    }} />);
    expect(markup).toContain("검색 결과 없음");
    expect(markup).toContain("조건을 변경해 주세요.");
    expect(markup).toContain('href="/disclosures"');
    expect(markup).toContain("조건 초기화");
  });
});

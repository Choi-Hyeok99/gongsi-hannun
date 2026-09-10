import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompanyCategoryFilter } from "@/components/CompanyCategoryFilter";
import { ThemeToggle } from "@/components/ThemeToggle";

describe("CompanyCategoryFilter", () => {
  it("renders compact category links and preserves the search query", () => {
    const markup = renderToStaticMarkup(<CompanyCategoryFilter query="삼성" selectedCategory="SEMICONDUCTOR" />);
    expect(markup).toContain("업종 카테고리");
    expect(markup).toContain("반도체");
    expect(markup).toContain("aria-current=\"page\"");
    expect(markup).toContain("query=%EC%82%BC%EC%84%B1");
  });
});

describe("ThemeToggle", () => {
  it("renders an accessible dark-mode action by default", () => {
    const markup = renderToStaticMarkup(<ThemeToggle />);
    expect(markup).toContain("다크 모드로 전환");
    expect(markup).toContain("다크");
  });
});

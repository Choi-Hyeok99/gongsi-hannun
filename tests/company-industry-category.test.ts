import { describe, expect, it } from "vitest";
import { categorizeCompanyIndustry } from "@/domain/company";

describe("categorizeCompanyIndustry", () => {
  it.each([
    ["반도체 제조업", "SEMICONDUCTOR"],
    ["의약품 제조업", "BIO_HEALTHCARE"],
    ["응용 소프트웨어 개발 및 공급업", "IT_SOFTWARE"],
    ["자동차 부품 제조업", "AUTOMOTIVE"],
    ["금융 지원 서비스업", "FINANCE"],
  ] as const)("maps source sector %s to %s", (sector, expected) => {
    expect(categorizeCompanyIndustry(sector)).toBe(expected);
  });

  it("keeps a missing source sector unclassified", () => {
    expect(categorizeCompanyIndustry(null)).toBe("UNCLASSIFIED");
    expect(categorizeCompanyIndustry("  ")).toBe("UNCLASSIFIED");
  });

  it("uses other for a supplied sector outside the canonical groups", () => {
    expect(categorizeCompanyIndustry("교육 서비스업")).toBe("OTHER");
  });
});

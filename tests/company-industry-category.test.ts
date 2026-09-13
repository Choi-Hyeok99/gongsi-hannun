import { describe, expect, it } from "vitest";
import { categorizeCompanyIndustry, categorizeCompanyIndustryCode } from "@/domain/company";

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

describe("categorizeCompanyIndustryCode", () => {
  it.each([
    ["2612", "SEMICONDUCTOR"],
    ["21210", "BIO_HEALTHCARE"],
    ["62010", "IT_SOFTWARE"],
    ["264", "ELECTRONICS"],
    ["303", "AUTOMOTIVE"],
    ["201", "CHEMICAL_MATERIALS"],
    ["641", "FINANCE"],
    ["501", "TRANSPORT_LOGISTICS"],
  ] as const)("maps official code %s to %s", (code, expected) => {
    expect(categorizeCompanyIndustryCode(code)).toBe(expected);
  });

  it("does not infer a category from a missing or invalid code", () => {
    expect(categorizeCompanyIndustryCode(null)).toBe("UNCLASSIFIED");
    expect(categorizeCompanyIndustryCode("unknown")).toBe("UNCLASSIFIED");
  });
});

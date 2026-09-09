import { describe, expect, it } from "vitest";
import { classifyDisclosureReport, DISCLOSURE_CLASSIFICATION_VERSION } from "@/domain/disclosure-classification";

describe("classifyDisclosureReport", () => {
  it.each([
    ["단일판매ㆍ공급계약체결", "SUPPLY_CONTRACT", 75],
    ["타법인 주식 및 출자증권 취득결정", "INVESTMENT", 65],
    ["전환사채권발행결정", "FUNDRAISING", 75],
    ["회사합병 결정", "M_AND_A", 85],
    ["매출액 또는 손익구조 30% 이상 변경", "EARNINGS", 70],
    ["무상증자결정", "CAPITAL_CHANGE", 65],
    ["최대주주 변경", "SHAREHOLDER_CHANGE", 60],
    ["임원ㆍ주요주주 특정증권등 소유상황보고서", "INSIDER_OWNERSHIP_CHANGE", 50],
    ["신규시설투자등", "FACILITY_EXPANSION", 70],
    ["사업목적 추가", "NEW_BUSINESS", 55],
    ["임상시험 결과", "CLINICAL_RESULT", 85],
    ["국책과제 선정", "POLICY_SUPPORT", 50],
    ["대표이사 변경", "MANAGEMENT_CHANGE", 60],
    ["투자판단 관련 주요경영사항", "MATERIAL_DISCLOSURE", 55],
    ["기업설명회(IR) 개최", "OTHER", 20],
  ] as const)("classifies %s", (reportName, eventType, score) => {
    expect(classifyDisclosureReport(reportName)).toMatchObject({
      eventType,
      ruleImportanceScore: score,
      importanceVersion: DISCLOSURE_CLASSIFICATION_VERSION,
    });
  });

  it("uses the more specific clinical rule before a generic material-disclosure phrase", () => {
    expect(classifyDisclosureReport("투자판단 관련 주요경영사항(임상시험 결과)"))
      .toMatchObject({ eventType: "CLINICAL_RESULT", matchedRuleId: "clinical-result" });
  });

  it("adds an auditable reason and score adjustment for corrections", () => {
    const result = classifyDisclosureReport("[기재정정] 단일판매·공급계약체결");

    expect(result.ruleImportanceScore).toBe(80);
    expect(result.importanceReasons).toEqual([
      "매출에 영향을 줄 수 있는 판매·공급계약에 관한 공시입니다.",
      "정정 공시이므로 이전 공시에서 변경된 내용을 확인해야 합니다.",
    ]);
  });

  it("increases attention for cancellation, withdrawal, or termination markers", () => {
    expect(classifyDisclosureReport("단일판매ㆍ공급계약 해지")).toMatchObject({
      eventType: "SUPPLY_CONTRACT",
      ruleImportanceScore: 85,
    });
  });

  it("returns a stable fallback for an empty title", () => {
    expect(classifyDisclosureReport("  ")).toEqual({
      eventType: "OTHER",
      matchedRuleId: "other",
      ruleImportanceScore: 20,
      importanceReasons: ["제목만으로 특정 중요 공시 유형을 판별하기 어렵습니다."],
      importanceVersion: DISCLOSURE_CLASSIFICATION_VERSION,
    });
  });
});

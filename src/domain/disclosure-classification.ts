export const DISCLOSURE_CLASSIFICATION_VERSION = "report-name-v1";

export const DISCLOSURE_EVENT_TYPES = [
  "SUPPLY_CONTRACT",
  "INVESTMENT",
  "FUNDRAISING",
  "M_AND_A",
  "EARNINGS",
  "CAPITAL_CHANGE",
  "SHAREHOLDER_CHANGE",
  "INSIDER_OWNERSHIP_CHANGE",
  "FACILITY_EXPANSION",
  "NEW_BUSINESS",
  "CLINICAL_RESULT",
  "POLICY_SUPPORT",
  "MANAGEMENT_CHANGE",
  "MATERIAL_DISCLOSURE",
  "OTHER",
] as const;

export type DisclosureEventType = (typeof DISCLOSURE_EVENT_TYPES)[number];

const EVENT_TYPE_LABELS: Readonly<Record<DisclosureEventType, string>> = {
  SUPPLY_CONTRACT: "공급계약",
  INVESTMENT: "투자",
  FUNDRAISING: "자금조달",
  M_AND_A: "인수·합병",
  EARNINGS: "실적",
  CAPITAL_CHANGE: "자본변동",
  SHAREHOLDER_CHANGE: "주주변동",
  INSIDER_OWNERSHIP_CHANGE: "임원·주요주주",
  FACILITY_EXPANSION: "시설투자",
  NEW_BUSINESS: "신규사업",
  CLINICAL_RESULT: "임상·허가",
  POLICY_SUPPORT: "정책지원",
  MANAGEMENT_CHANGE: "경영변동",
  MATERIAL_DISCLOSURE: "주요경영사항",
  OTHER: "기타",
};

export function isDisclosureEventType(value: string | null): value is DisclosureEventType {
  return DISCLOSURE_EVENT_TYPES.some((eventType) => eventType === value);
}

export function getDisclosureEventTypeLabel(eventType: DisclosureEventType): string {
  return EVENT_TYPE_LABELS[eventType];
}

export type DisclosureClassification = Readonly<{
  eventType: DisclosureEventType;
  matchedRuleId: string;
  ruleImportanceScore: number;
  importanceReasons: readonly string[];
  importanceVersion: typeof DISCLOSURE_CLASSIFICATION_VERSION;
}>;

type ClassificationRule = Readonly<{
  id: string;
  eventType: DisclosureEventType;
  score: number;
  reason: string;
  keywords: readonly string[];
}>;

const RULES: readonly ClassificationRule[] = [
  {
    id: "clinical-result",
    eventType: "CLINICAL_RESULT",
    score: 85,
    reason: "임상시험의 결과 또는 진행 상황에 관한 공시입니다.",
    keywords: ["임상시험", "임상결과", "품목허가", "신약허가"],
  },
  {
    id: "merger-acquisition",
    eventType: "M_AND_A",
    score: 85,
    reason: "합병·분할·인수 등 기업 구조의 중대한 변화에 관한 공시입니다.",
    keywords: ["회사합병", "합병결정", "회사분할", "분할합병", "주식교환", "주식이전", "영업양수", "영업양도", "공개매수"],
  },
  {
    id: "supply-contract",
    eventType: "SUPPLY_CONTRACT",
    score: 75,
    reason: "매출에 영향을 줄 수 있는 판매·공급계약에 관한 공시입니다.",
    keywords: ["단일판매", "공급계약", "수주계약", "수주공시"],
  },
  {
    id: "fundraising",
    eventType: "FUNDRAISING",
    score: 75,
    reason: "외부 자금 조달과 잠재적 지분 희석에 관한 공시입니다.",
    keywords: ["유상증자", "전환사채", "신주인수권부사채", "교환사채", "조건부자본증권", "단기사채발행", "사채권발행"],
  },
  {
    id: "earnings",
    eventType: "EARNINGS",
    score: 70,
    reason: "매출·손익 등 기업 실적에 관한 공시입니다.",
    keywords: ["잠정실적", "영업실적", "매출액또는손익구조", "연결재무제표기준영업", "결산실적"],
  },
  {
    id: "facility-expansion",
    eventType: "FACILITY_EXPANSION",
    score: 70,
    reason: "생산능력이나 사업 규모에 영향을 줄 수 있는 시설 투자 공시입니다.",
    keywords: ["신규시설투자", "시설투자", "공장신설", "생산시설"],
  },
  {
    id: "investment",
    eventType: "INVESTMENT",
    score: 65,
    reason: "다른 법인 또는 주요 자산에 대한 투자 공시입니다.",
    keywords: ["타법인주식및출자증권취득", "유형자산취득", "출자결정", "투자결정"],
  },
  {
    id: "capital-change",
    eventType: "CAPITAL_CHANGE",
    score: 65,
    reason: "주식 수나 자본 구조에 영향을 주는 공시입니다.",
    keywords: ["무상증자", "감자결정", "주식병합", "주식분할", "액면분할", "자기주식취득", "자기주식처분"],
  },
  {
    id: "management-change",
    eventType: "MANAGEMENT_CHANGE",
    score: 60,
    reason: "경영진 또는 회사 운영의 중대한 변화에 관한 공시입니다.",
    keywords: ["대표이사변경", "회생절차", "파산신청", "해산사유", "영업정지"],
  },
  {
    id: "shareholder-change",
    eventType: "SHAREHOLDER_CHANGE",
    score: 60,
    reason: "최대주주나 주요 지배주주의 변동에 관한 공시입니다.",
    keywords: ["최대주주변경", "최대주주등소유주식변동", "주식등의대량보유상황", "경영권변경등에관한계약"],
  },
  {
    id: "insider-ownership-change",
    eventType: "INSIDER_OWNERSHIP_CHANGE",
    score: 50,
    reason: "임원·주요주주의 보유 증권 변동에 관한 공시입니다.",
    keywords: ["임원주요주주특정증권", "임원ㆍ주요주주특정증권", "임원·주요주주특정증권"],
  },
  {
    id: "new-business",
    eventType: "NEW_BUSINESS",
    score: 55,
    reason: "신규 사업 진출 또는 사업 목적 변경에 관한 공시입니다.",
    keywords: ["신규사업", "사업목적변경", "사업목적추가"],
  },
  {
    id: "policy-support",
    eventType: "POLICY_SUPPORT",
    score: 50,
    reason: "정부 지원이나 국책 과제 선정에 관한 공시입니다.",
    keywords: ["정부지원", "국책과제", "정부과제", "지원사업선정"],
  },
  {
    id: "material-disclosure",
    eventType: "MATERIAL_DISCLOSURE",
    score: 55,
    reason: "투자 판단에 주의가 필요한 주요 경영·시장 관련 공시입니다.",
    keywords: ["주요사항보고서", "투자판단관련주요경영사항", "조회공시", "매매거래정지", "상장폐지", "횡령", "배임", "소송", "감사의견"],
  },
];

const FALLBACK_RULE: ClassificationRule = {
  id: "other",
  eventType: "OTHER",
  score: 20,
  reason: "제목만으로 특정 중요 공시 유형을 판별하기 어렵습니다.",
  keywords: [],
};

function normalizeReportName(reportName: string): string {
  return reportName
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s·ㆍ･․・:()[\]{}'"“”‘’,._\-/\\]/g, "");
}

function findRule(normalizedReportName: string): ClassificationRule {
  return RULES.find((rule) => rule.keywords.some((keyword) => normalizedReportName.includes(normalizeReportName(keyword)))) ?? FALLBACK_RULE;
}

export function classifyDisclosureReport(reportName: string): DisclosureClassification {
  const normalizedReportName = normalizeReportName(reportName);
  const rule = findRule(normalizedReportName);
  const reasons = [rule.reason];
  let score = rule.score;

  if (normalizedReportName.includes("정정")) {
    score += 5;
    reasons.push("정정 공시이므로 이전 공시에서 변경된 내용을 확인해야 합니다.");
  }

  if (["취소", "철회", "해지"].some((marker) => normalizedReportName.includes(marker))) {
    score += 10;
    reasons.push("기존 결정의 취소·철회·해지 가능성이 있어 주의가 필요합니다.");
  }

  return {
    eventType: rule.eventType,
    matchedRuleId: rule.id,
    ruleImportanceScore: Math.min(score, 100),
    importanceReasons: reasons,
    importanceVersion: DISCLOSURE_CLASSIFICATION_VERSION,
  };
}

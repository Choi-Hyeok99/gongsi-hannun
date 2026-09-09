export type Market = "KOSPI" | "KOSDAQ" | "KONEX" | "OTHER";

export const COMPANY_INDUSTRY_CATEGORIES = [
  "SEMICONDUCTOR",
  "BIO_HEALTHCARE",
  "IT_SOFTWARE",
  "ELECTRONICS",
  "AUTOMOTIVE",
  "INDUSTRIAL_MANUFACTURING",
  "CHEMICAL_MATERIALS",
  "ENERGY_UTILITIES",
  "FINANCE",
  "CONSUMER_RETAIL",
  "MEDIA_TELECOM",
  "CONSTRUCTION_REAL_ESTATE",
  "TRANSPORT_LOGISTICS",
  "OTHER",
  "UNCLASSIFIED",
] as const;

export type CompanyIndustryCategory = (typeof COMPANY_INDUSTRY_CATEGORIES)[number];

export const COMPANY_INDUSTRY_CATEGORY_LABELS: Readonly<Record<CompanyIndustryCategory, string>> = {
  SEMICONDUCTOR: "반도체",
  BIO_HEALTHCARE: "바이오·헬스케어",
  IT_SOFTWARE: "IT·소프트웨어",
  ELECTRONICS: "전자·전기",
  AUTOMOTIVE: "자동차",
  INDUSTRIAL_MANUFACTURING: "산업재·제조",
  CHEMICAL_MATERIALS: "화학·소재",
  ENERGY_UTILITIES: "에너지·유틸리티",
  FINANCE: "금융",
  CONSUMER_RETAIL: "소비재·유통",
  MEDIA_TELECOM: "미디어·통신",
  CONSTRUCTION_REAL_ESTATE: "건설·부동산",
  TRANSPORT_LOGISTICS: "운송·물류",
  OTHER: "기타",
  UNCLASSIFIED: "미분류",
};

const CATEGORY_KEYWORDS: readonly Readonly<{
  category: Exclude<CompanyIndustryCategory, "OTHER" | "UNCLASSIFIED">;
  keywords: readonly string[];
}>[] = [
  { category: "SEMICONDUCTOR", keywords: ["반도체"] },
  { category: "BIO_HEALTHCARE", keywords: ["바이오", "제약", "의약", "의료", "헬스케어"] },
  { category: "IT_SOFTWARE", keywords: ["소프트웨어", "정보기술", "IT 서비스", "컴퓨터", "인터넷"] },
  { category: "ELECTRONICS", keywords: ["전자", "전기", "디스플레이", "통신장비"] },
  { category: "AUTOMOTIVE", keywords: ["자동차", "자동차부품"] },
  { category: "CHEMICAL_MATERIALS", keywords: ["화학", "소재", "철강", "금속", "비금속", "고무", "플라스틱"] },
  { category: "ENERGY_UTILITIES", keywords: ["에너지", "전력", "가스", "수도", "석유"] },
  { category: "FINANCE", keywords: ["금융", "은행", "보험", "증권", "신탁"] },
  { category: "CONSUMER_RETAIL", keywords: ["유통", "소매", "식품", "음료", "의류", "화장품", "생활용품"] },
  { category: "MEDIA_TELECOM", keywords: ["미디어", "방송", "통신", "콘텐츠", "엔터테인먼트"] },
  { category: "CONSTRUCTION_REAL_ESTATE", keywords: ["건설", "부동산", "건축", "토목"] },
  { category: "TRANSPORT_LOGISTICS", keywords: ["운송", "물류", "항공", "해운"] },
  { category: "INDUSTRIAL_MANUFACTURING", keywords: ["제조", "기계", "장비", "조선"] },
];

/** Maps a source-provided industry label. It never infers an industry from a company name. */
export function categorizeCompanyIndustry(sector: string | null): CompanyIndustryCategory {
  const normalized = sector?.normalize("NFKC").trim().toLocaleLowerCase("ko-KR") ?? "";
  if (!normalized) return "UNCLASSIFIED";
  return CATEGORY_KEYWORDS.find(({ keywords }) =>
    keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase("ko-KR"))),
  )?.category ?? "OTHER";
}

export type Company = Readonly<{
  id: string;
  dartCorpCode: string;
  stockCode: string;
  nameKo: string;
  market: Market;
  sector: string | null;
  industryCategory: CompanyIndustryCategory;
}>;

export interface CompanyRepository {
  search(query: string, limit: number, category?: CompanyIndustryCategory): Promise<readonly Company[]>;
  findByStockCode(stockCode: string): Promise<Company | null>;
}

export type Market = "KOSPI" | "KOSDAQ" | "KONEX" | "OTHER";

export function isListedMarket(market: Market): boolean {
  return market === "KOSPI" || market === "KOSDAQ" || market === "KONEX";
}

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

/** Maps the numeric industry code returned by OpenDART company.json. */
export function categorizeCompanyIndustryCode(industryCode: string | null): CompanyIndustryCategory {
  const code = industryCode?.trim() ?? "";
  if (!/^[0-9]{2,6}$/.test(code)) return "UNCLASSIFIED";

  if (code.startsWith("261")) return "SEMICONDUCTOR";
  if (startsWithAny(code, ["21", "271", "7011", "7013", "86"])) return "BIO_HEALTHCARE";
  if (startsWithAny(code, ["582", "62", "63"])) return "IT_SOFTWARE";
  if (startsWithAny(code, ["26", "27", "28"])) return "ELECTRONICS";
  if (code.startsWith("30")) return "AUTOMOTIVE";
  if (startsWithAny(code, ["19", "20", "22", "23", "24"])) return "CHEMICAL_MATERIALS";
  if (startsWithAny(code, ["35", "36"])) return "ENERGY_UTILITIES";
  if (startsWithAny(code, ["64", "65", "66"])) return "FINANCE";
  if (startsWithAny(code, ["45", "46", "47", "55", "56"])) return "CONSUMER_RETAIL";
  if (startsWithAny(code, ["58", "59", "60", "61", "90"])) return "MEDIA_TELECOM";
  if (startsWithAny(code, ["41", "42", "68"])) return "CONSTRUCTION_REAL_ESTATE";
  if (startsWithAny(code, ["49", "50", "51", "52"])) return "TRANSPORT_LOGISTICS";
  if (isBetween(Number(code.slice(0, 2)), 10, 34) || startsWithAny(code, ["38", "39"])) {
    return "INDUSTRIAL_MANUFACTURING";
  }
  return "OTHER";
}

function startsWithAny(value: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

function isBetween(value: number, minimum: number, maximum: number): boolean {
  return value >= minimum && value <= maximum;
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

export type CompanyPage = Readonly<{
  companies: readonly Company[];
  total: number;
}>;

export interface CompanyRepository {
  search(query: string, limit: number, category?: CompanyIndustryCategory): Promise<readonly Company[]>;
  searchPage(
    query: string,
    limit: number,
    offset: number,
    category?: CompanyIndustryCategory,
  ): Promise<CompanyPage>;
  findByStockCode(stockCode: string): Promise<Company | null>;
}

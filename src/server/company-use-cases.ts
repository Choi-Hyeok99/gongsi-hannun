import { COMPANY_INDUSTRY_CATEGORY_LABELS, type Company, type CompanyRepository, type CompanyIndustryCategory } from "@/domain/company";
import { normalizeCompanyCategory, normalizeCompanyQuery } from "@/server/company-query";

export type PublicCompany = Readonly<{
  stockCode: string;
  name: string;
  market: string;
  sector: string | null;
  industryCategory?: CompanyIndustryCategory;
  industryCategoryLabel?: string;
}>;

export type PublicCompanyPage = Readonly<{
  companies: readonly PublicCompany[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>;

// Editorial quick links only. Company names, classifications, and prices always come from live repositories.
const FEATURED_STOCK_CODES = ["005930", "000660", "373220", "005380", "000270", "035420", "035720", "005490"] as const;

function toPublicCompany(company: Company): PublicCompany {
  return {
    stockCode: company.stockCode,
    name: company.nameKo,
    market: company.market,
    sector: company.sector,
    industryCategory: company.industryCategory,
    industryCategoryLabel: COMPANY_INDUSTRY_CATEGORY_LABELS[company.industryCategory],
  };
}

export async function searchCompanies(
  repository: CompanyRepository,
  rawQuery: string | null,
  rawCategory: string | null = null,
): Promise<readonly PublicCompany[]> {
  const category = normalizeCompanyCategory(rawCategory);
  const hasQuery = Boolean(rawQuery?.normalize("NFKC").trim());
  const query = !hasQuery && category ? "" : normalizeCompanyQuery(rawQuery);
  const companies = await repository.search(query, 20, category);
  return companies.map(toPublicCompany);
}

export async function browseCompaniesPage(
  repository: CompanyRepository,
  rawQuery: string | null,
  rawCategory: string | null,
  rawPage: string | null,
  pageSize = 24,
): Promise<PublicCompanyPage> {
  const category = normalizeCompanyCategory(rawCategory);
  const trimmedQuery = rawQuery?.normalize("NFKC").trim() ?? "";
  const query = trimmedQuery ? normalizeCompanyQuery(trimmedQuery) : "";
  const parsedPage = Number(rawPage);
  let page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  let result = await repository.searchPage(query, pageSize, (page - 1) * pageSize, category);
  const totalPages = Math.max(1, Math.ceil(result.total / pageSize));
  if (page > totalPages) {
    page = totalPages;
    result = await repository.searchPage(query, pageSize, (page - 1) * pageSize, category);
  }
  return {
    companies: result.companies.map(toPublicCompany),
    total: result.total,
    page,
    pageSize,
    totalPages,
  };
}

export async function getCompany(
  repository: CompanyRepository,
  stockCode: string,
): Promise<PublicCompany | null> {
  if (!/^[0-9]{6}$/.test(stockCode)) return null;
  const company = await repository.findByStockCode(stockCode);
  return company ? toPublicCompany(company) : null;
}

export async function listFeaturedCompanies(repository: CompanyRepository): Promise<readonly PublicCompany[]> {
  const companies = await Promise.all(FEATURED_STOCK_CODES.map((code) => repository.findByStockCode(code)));
  return companies
    .filter((company): company is Company => company !== null && (company.market === "KOSPI" || company.market === "KOSDAQ"))
    .map(toPublicCompany);
}

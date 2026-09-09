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

export async function getCompany(
  repository: CompanyRepository,
  stockCode: string,
): Promise<PublicCompany | null> {
  if (!/^[0-9]{6}$/.test(stockCode)) return null;
  const company = await repository.findByStockCode(stockCode);
  return company ? toPublicCompany(company) : null;
}

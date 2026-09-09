import type { Company, CompanyRepository } from "@/domain/company";
import { normalizeCompanyQuery } from "@/server/company-query";

export type PublicCompany = Readonly<{
  stockCode: string;
  name: string;
  market: string;
  sector: string | null;
}>;

function toPublicCompany(company: Company): PublicCompany {
  return { stockCode: company.stockCode, name: company.nameKo, market: company.market, sector: company.sector };
}

export async function searchCompanies(repository: CompanyRepository, rawQuery: string | null): Promise<readonly PublicCompany[]> {
  const query = normalizeCompanyQuery(rawQuery);
  const companies = await repository.search(query, 20);
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

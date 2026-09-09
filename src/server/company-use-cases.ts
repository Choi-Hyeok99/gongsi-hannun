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

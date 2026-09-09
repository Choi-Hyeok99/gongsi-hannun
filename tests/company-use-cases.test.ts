import { describe, expect, it, vi } from "vitest";
import type { Company, CompanyRepository } from "@/domain/company";
import { InvalidInputError } from "@/domain/errors";
import { getCompany, searchCompanies } from "@/server/company-use-cases";

const sample: Company = { id: "company-1", dartCorpCode: "00126380", stockCode: "005930", nameKo: "삼성전자", market: "KOSPI", sector: "반도체" };

class FixtureCompanyRepository implements CompanyRepository {
  async search(query: string): Promise<readonly Company[]> { return sample.nameKo.includes(query) || sample.stockCode === query ? [sample] : []; }
  async findByStockCode(stockCode: string): Promise<Company | null> { return stockCode === sample.stockCode ? sample : null; }
}

describe("searchCompanies", () => {
  const repository = new FixtureCompanyRepository();
  it("returns only public fields", async () => { await expect(searchCompanies(repository, "삼성")).resolves.toEqual([{ stockCode: "005930", name: "삼성전자", market: "KOSPI", sector: "반도체" }]); });
  it("accepts a six digit stock code", async () => { await expect(searchCompanies(repository, "005930")).resolves.toHaveLength(1); });
  it("rejects invalid numeric codes", async () => { await expect(searchCompanies(repository, "5930")).rejects.toBeInstanceOf(InvalidInputError); });
  it("rejects an empty query", async () => { await expect(searchCompanies(repository, " ")).rejects.toBeInstanceOf(InvalidInputError); });
});

describe("getCompany", () => {
  it("returns a public company for a valid stock code", async () => {
    const repository = new FixtureCompanyRepository();
    await expect(getCompany(repository, "005930")).resolves.toMatchObject({
      stockCode: "005930",
      name: "삼성전자",
    });
  });

  it("does not query the repository for an invalid stock code", async () => {
    const repository = new FixtureCompanyRepository();
    const findByStockCode = vi.spyOn(repository, "findByStockCode");
    await expect(getCompany(repository, "invalid")).resolves.toBeNull();
    expect(findByStockCode).not.toHaveBeenCalled();
  });
});

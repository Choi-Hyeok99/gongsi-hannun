export type Market = "KOSPI" | "KOSDAQ" | "KONEX" | "OTHER";

export type Company = Readonly<{
  id: string;
  dartCorpCode: string;
  stockCode: string;
  nameKo: string;
  market: Market;
  sector: string | null;
}>;

export interface CompanyRepository {
  search(query: string, limit: number): Promise<readonly Company[]>;
  findByStockCode(stockCode: string): Promise<Company | null>;
}

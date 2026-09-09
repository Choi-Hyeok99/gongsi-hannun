import type { Market } from "@/domain/company";

export type DisclosureSummary = Readonly<{
  receiptNumber: string;
  reportName: string;
  filerName: string | null;
  disclosedOn: string;
  originalUrl: string;
  status: "ACTIVE" | "CORRECTED" | "CANCELLED" | "REVIEW_REQUIRED";
  company: Readonly<{
    stockCode: string;
    name: string;
    market: Market;
  }>;
}>;

export type DisclosureSearch = Readonly<{
  date: string | null;
  page: number;
  pageSize: number;
}>;

export type DisclosureSearchResult = Readonly<{
  items: readonly DisclosureSummary[];
  totalCount: number;
}>;

export interface DisclosureRepository {
  findLatest(limit: number): Promise<readonly DisclosureSummary[]>;
  search(query: DisclosureSearch): Promise<DisclosureSearchResult>;
  findByReceiptNumber(receiptNumber: string): Promise<DisclosureSummary | null>;
  findByCompanyStockCode(stockCode: string, limit: number): Promise<readonly DisclosureSummary[]>;
}

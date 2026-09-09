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

export interface DisclosureRepository {
  findLatest(limit: number): Promise<readonly DisclosureSummary[]>;
  findByReceiptNumber(receiptNumber: string): Promise<DisclosureSummary | null>;
  findByCompanyStockCode(stockCode: string, limit: number): Promise<readonly DisclosureSummary[]>;
}

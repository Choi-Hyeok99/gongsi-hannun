export type DartCorporationClass = "Y" | "K" | "N";
export type DisclosureMarket = "KOSPI" | "KOSDAQ" | "KONEX";

export type DisclosureRecord = Readonly<{
  dartCorpCode: string;
  companyName: string;
  stockCode: string;
  corpClass: DartCorporationClass;
  filerName: string | null;
  reportName: string;
  receiptNumber: string;
  disclosedOn: string;
  remarks: string | null;
  originalUrl: string;
}>;

export type DisclosurePage = Readonly<{
  records: readonly DisclosureRecord[];
  page: number;
  totalPages: number;
  totalCount: number;
}>;

export type DisclosureQuery = Readonly<{
  fromDate: string;
  toDate: string;
  page: number;
  corpClass?: DartCorporationClass;
}>;

export type DisclosureSyncCounts = Readonly<{
  readCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
}>;

export interface DisclosureSource {
  fetchPage(query: DisclosureQuery): Promise<DisclosurePage>;
}

export interface DisclosureSyncRepository {
  startRun(fromDate: string, toDate: string): Promise<string>;
  upsertDisclosures(records: readonly DisclosureRecord[]): Promise<DisclosureSyncCounts>;
  completeRun(runId: string, counts: DisclosureSyncCounts): Promise<void>;
  failRun(runId: string, readCount: number, error: unknown): Promise<void>;
}

export function marketFromCorpClass(value: DartCorporationClass): DisclosureMarket {
  if (value === "Y") return "KOSPI";
  if (value === "K") return "KOSDAQ";
  return "KONEX";
}

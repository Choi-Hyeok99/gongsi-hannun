export type CompanyDirectoryRecord = Readonly<{
  dartCorpCode: string;
  nameKo: string;
  nameEn: string | null;
  stockCode: string | null;
  sourceUpdatedOn: string;
}>;

export type ListedCompanyInput = Readonly<{
  dartCorpCode: string;
  nameKo: string;
  nameEn: string | null;
  stockCode: string;
  sourceUpdatedOn: string;
}>;

export type CompanySyncCounts = Readonly<{
  readCount: number;
  createdCount: number;
  updatedCount: number;
}>;

export interface CompanyDirectorySource {
  fetchDirectory(): Promise<readonly CompanyDirectoryRecord[]>;
}

export interface CompanySyncRepository {
  startRun(): Promise<string>;
  upsertListedCompanies(companies: readonly ListedCompanyInput[]): Promise<Readonly<{ createdCount: number; updatedCount: number }>>;
  completeRun(runId: string, counts: CompanySyncCounts): Promise<void>;
  failRun(runId: string, readCount: number, error: unknown): Promise<void>;
}

import type { CompanyIndustryCategory, Market } from "@/domain/company";

export type CompanyIndustrySyncTarget = Readonly<{
  id: string;
  dartCorpCode: string;
}>;

export type CompanyIndustryProfile = Readonly<{
  dartCorpCode: string;
  industryCode: string | null;
  market: Market;
}>;

export type CompanyIndustrySyncCounts = Readonly<{
  attemptedCount: number;
  updatedCount: number;
  failedCount: number;
  remainingCount: number;
  nextCursor: string | null;
}>;

export type CompanyIndustryCompleteness = Readonly<{
  totalActiveListedCount: number;
  marketOtherCount: number;
  categoryOtherCount: number;
  categoryUnclassifiedCount: number;
  profilePendingCount: number;
  profileFailedCount: number;
}>;

export type CompanyIndustrySyncRunOptions = Readonly<{
  limit: number;
  startingAfterId?: string;
  retryBefore: string;
}>;

export interface CompanyIndustrySource {
  fetchProfile(dartCorpCode: string): Promise<CompanyIndustryProfile | null>;
}

export interface CompanyIndustrySyncRepository {
  startRun(options: CompanyIndustrySyncRunOptions): Promise<string>;
  findPending(limit: number, afterId: string | undefined, retryBefore: string): Promise<readonly CompanyIndustrySyncTarget[]>;
  saveProfile(
    target: CompanyIndustrySyncTarget,
    profile: CompanyIndustryProfile | null,
    category: CompanyIndustryCategory,
  ): Promise<void>;
  recordFailure(target: CompanyIndustrySyncTarget, error: unknown): Promise<void>;
  countPending(): Promise<number>;
  getCompleteness(): Promise<CompanyIndustryCompleteness>;
  finishRun(runId: string, counts: CompanyIndustrySyncCounts, stoppedReason?: string): Promise<void>;
}

import { describe, expect, it, vi } from "vitest";
import type {
  CompanyIndustrySource,
  CompanyIndustrySyncRepository,
  CompanyIndustrySyncTarget,
} from "@/domain/company-industry-sync";
import { ExternalServiceError } from "@/domain/errors";
import { syncCompanyIndustries } from "@/jobs/collector/sync-company-industries";

const targets: readonly CompanyIndustrySyncTarget[] = [
  { id: "1", dartCorpCode: "00000001" },
  { id: "2", dartCorpCode: "00000002" },
  { id: "3", dartCorpCode: "00000003" },
];

function createRepository(remainingCount = 0): CompanyIndustrySyncRepository {
  return {
    startRun: vi.fn(async () => "run-id"),
    findPending: vi.fn(async (limit, afterId) => targets.filter((target) => !afterId || target.id > afterId).slice(0, limit)),
    saveProfile: vi.fn(async () => undefined),
    recordFailure: vi.fn(async () => undefined),
    countPending: vi.fn(async () => remainingCount),
    getCompleteness: vi.fn(async () => ({
      totalActiveListedCount: targets.length,
      marketOtherCount: 0,
      categoryOtherCount: 0,
      categoryUnclassifiedCount: 0,
      profilePendingCount: remainingCount,
      profileFailedCount: 0,
    })),
    finishRun: vi.fn(async () => undefined),
  };
}

describe("syncCompanyIndustries", () => {
  it("processes batches and saves a canonical category for each success", async () => {
    const source: CompanyIndustrySource = {
      fetchProfile: vi.fn(async (dartCorpCode: string) => ({ dartCorpCode, industryCode: "2612", market: "KOSPI" as const })),
    };
    const repository = createRepository();

    await expect(syncCompanyIndustries({ source, repository, batchSize: 2, delayMs: 0 })).resolves.toEqual({
      attemptedCount: 3,
      updatedCount: 3,
      failedCount: 0,
      remainingCount: 0,
      nextCursor: "3",
    });
    expect(repository.saveProfile).toHaveBeenCalledTimes(3);
    expect(repository.saveProfile).toHaveBeenCalledWith(targets[0], expect.anything(), "SEMICONDUCTOR");
    expect(repository.finishRun).toHaveBeenCalledWith("run-id", expect.anything(), undefined);
  });

  it("records a partial failure and continues with later companies", async () => {
    const source: CompanyIndustrySource = {
      fetchProfile: vi.fn(async (dartCorpCode: string) => {
        if (dartCorpCode === "00000002") throw new ExternalServiceError("UNAVAILABLE", "temporary");
        return { dartCorpCode, industryCode: "641", market: "KOSPI" as const };
      }),
    };
    const repository = createRepository(1);

    await expect(syncCompanyIndustries({ source, repository, delayMs: 0 })).resolves.toMatchObject({
      attemptedCount: 3,
      updatedCount: 2,
      failedCount: 1,
      remainingCount: 1,
      nextCursor: "3",
    });
    expect(repository.recordFailure).toHaveBeenCalledOnce();
    expect(repository.saveProfile).toHaveBeenCalledTimes(2);
    expect(repository.finishRun).toHaveBeenCalledWith("run-id", expect.anything(), "FAILED_COMPANIES_REMAIN");
  });

  it("stops immediately when OpenDART reports the request limit", async () => {
    const rateLimit = new ExternalServiceError("RATE_LIMITED", "limited");
    const source: CompanyIndustrySource = { fetchProfile: vi.fn(async () => { throw rateLimit; }) };
    const repository = createRepository(3);

    await expect(syncCompanyIndustries({ source, repository, delayMs: 0 })).rejects.toBe(rateLimit);
    expect(source.fetchProfile).toHaveBeenCalledOnce();
    expect(repository.recordFailure).toHaveBeenCalledOnce();
    expect(repository.finishRun).toHaveBeenCalledWith("run-id", expect.anything(), "RATE_LIMITED");
  });
});

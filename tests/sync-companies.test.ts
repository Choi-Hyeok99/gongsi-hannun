import { describe, expect, it, vi } from "vitest";
import type { CompanyDirectorySource, CompanySyncRepository } from "@/domain/company-sync";
import { syncCompanies } from "@/jobs/collector/sync-companies";

function createRepository(): CompanySyncRepository {
  return {
    startRun: vi.fn(async () => "run-id"),
    upsertListedCompanies: vi.fn(async () => ({ createdCount: 1, updatedCount: 0 })),
    completeRun: vi.fn(async () => undefined),
    failRun: vi.fn(async () => undefined),
  };
}

describe("syncCompanies", () => {
  it("stores only listed companies and completes the run", async () => {
    const source: CompanyDirectorySource = {
      fetchDirectory: vi.fn(async () => [
        { dartCorpCode: "00126380", nameKo: "삼성전자", nameEn: null, stockCode: "005930", sourceUpdatedOn: "2026-09-09" },
        { dartCorpCode: "00000001", nameKo: "비상장", nameEn: null, stockCode: null, sourceUpdatedOn: "2026-09-09" },
      ]),
    };
    const repository = createRepository();

    await expect(syncCompanies({ source, repository })).resolves.toEqual({
      readCount: 2,
      createdCount: 1,
      updatedCount: 0,
    });
    expect(repository.upsertListedCompanies).toHaveBeenCalledWith([
      expect.objectContaining({ stockCode: "005930" }),
    ]);
    expect(repository.completeRun).toHaveBeenCalledOnce();
  });

  it("records a failed run when the source fails", async () => {
    const failure = new Error("source failed");
    const source: CompanyDirectorySource = {
      fetchDirectory: vi.fn(async () => {
        throw failure;
      }),
    };
    const repository = createRepository();

    await expect(syncCompanies({ source, repository })).rejects.toThrow("source failed");
    expect(repository.failRun).toHaveBeenCalledWith("run-id", 0, failure);
  });
});

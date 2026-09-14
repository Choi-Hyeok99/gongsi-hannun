import { describe, expect, it, vi } from "vitest";
import type {
  DisclosureRecord,
  DisclosureSource,
  DisclosureSyncRepository,
} from "@/domain/disclosure";
import { syncDisclosures } from "@/jobs/collector/sync-disclosures";

const disclosure: DisclosureRecord = {
  dartCorpCode: "00126380",
  companyName: "삼성전자",
  stockCode: "005930",
  corpClass: "Y",
  filerName: "삼성전자",
  reportName: "주요사항보고서",
  receiptNumber: "20260909000001",
  disclosedOn: "2026-09-09",
  remarks: null,
  originalUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260909000001",
};

function createRepository(): DisclosureSyncRepository {
  return {
    startRun: vi.fn(async () => "run-id"),
    upsertDisclosures: vi.fn(async (_runId, _collectedAt, records) => ({
      readCount: records.length,
      createdCount: records.length,
      updatedCount: 0,
      failedCount: 0,
    })),
    completeRun: vi.fn(async () => undefined),
    failRun: vi.fn(async () => undefined),
  };
}

describe("syncDisclosures", () => {
  it("collects every page for listed markets and deduplicates receipt numbers", async () => {
    const source: DisclosureSource = {
      fetchPage: vi.fn(async (query) => ({
        records: query.corpClass === "Y" ? [disclosure] : [],
        page: query.page,
        totalPages: query.corpClass === "Y" ? 2 : 1,
        totalCount: query.corpClass === "Y" ? 2 : 0,
      })),
    };
    const repository = createRepository();

    const now = new Date("2026-09-09T01:23:45.000Z");
    await expect(syncDisclosures({ ...repositoryDependencies(source, repository), now: () => now }, "20260909", "20260909"))
      .resolves.toEqual({ readCount: 1, createdCount: 1, updatedCount: 0, failedCount: 0 });
    expect(source.fetchPage).toHaveBeenCalledTimes(4);
    expect(repository.upsertDisclosures).toHaveBeenCalledWith("run-id", now.toISOString(), [disclosure]);
    expect(repository.completeRun).toHaveBeenCalledOnce();
  });

  it("records the failed run when collection fails", async () => {
    const failure = new Error("source failed");
    const source: DisclosureSource = {
      fetchPage: vi.fn(async () => {
        throw failure;
      }),
    };
    const repository = createRepository();

    await expect(syncDisclosures(repositoryDependencies(source, repository), "20260909", "20260909"))
      .rejects.toThrow("source failed");
    expect(repository.failRun).toHaveBeenCalledWith("run-id", 0, failure);
  });

  it("rejects an invalid date before creating a run", async () => {
    const source: DisclosureSource = {
      fetchPage: vi.fn(),
    };
    const repository = createRepository();
    await expect(syncDisclosures(repositoryDependencies(source, repository), "20260910", "20260909"))
      .rejects.toBeInstanceOf(RangeError);
    expect(repository.startRun).not.toHaveBeenCalled();
  });
});

function repositoryDependencies(
  source: DisclosureSource,
  repository: DisclosureSyncRepository,
) {
  return { source, repository };
}

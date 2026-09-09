import { describe, expect, it, vi } from "vitest";
import type {
  DailyPriceSource,
  DailyPriceSyncRepository,
} from "@/domain/daily-price";
import { syncDailyPrices } from "@/jobs/collector/sync-daily-prices";

const validPrice = {
  stockCode: "005930",
  tradingDate: "2026-09-09",
  openPrice: "70000",
  highPrice: "71000",
  lowPrice: "69500",
  closePrice: "70500",
  volume: "12345678",
} as const;

function createRepository(): DailyPriceSyncRepository {
  return {
    startRun: vi.fn(async () => "run-id"),
    upsertDailyPrices: vi.fn(async () => ({ createdCount: 1, updatedCount: 0, failedCount: 0 })),
    completeRun: vi.fn(async () => undefined),
    failRun: vi.fn(async () => undefined),
  };
}

describe("syncDailyPrices", () => {
  it("deduplicates provider rows and completes the ingestion run", async () => {
    const source: DailyPriceSource = {
      sourceId: "KRX_DAILY",
      fetchDailyPrices: vi.fn(async () => [validPrice, validPrice]),
    };
    const repository = createRepository();

    await expect(syncDailyPrices({ source, repository }, {
      stockCodes: ["005930", "005930"],
      from: "2026-09-09",
      to: "2026-09-09",
    })).resolves.toEqual({ readCount: 2, createdCount: 1, updatedCount: 0, failedCount: 0 });
    expect(source.fetchDailyPrices).toHaveBeenCalledWith({
      stockCodes: ["005930"],
      from: "2026-09-09",
      to: "2026-09-09",
    });
    expect(repository.upsertDailyPrices).toHaveBeenCalledWith("run-id", "KRX_DAILY", [validPrice]);
    expect(repository.completeRun).toHaveBeenCalledOnce();
  });

  it("rejects invalid provider prices and records a failed run", async () => {
    const source: DailyPriceSource = {
      sourceId: "KRX_DAILY",
      fetchDailyPrices: vi.fn(async () => [{ ...validPrice, highPrice: "69000" }]),
    };
    const repository = createRepository();

    await expect(syncDailyPrices({ source, repository }, {
      stockCodes: ["005930"],
      from: "2026-09-09",
      to: "2026-09-09",
    })).rejects.toThrow("가격 범위");
    expect(repository.failRun).toHaveBeenCalledWith("run-id", 1, expect.any(Error));
  });

  it("rejects malformed requests before creating an ingestion run", async () => {
    const source: DailyPriceSource = {
      sourceId: "KRX_DAILY",
      fetchDailyPrices: vi.fn(async () => []),
    };
    const repository = createRepository();

    await expect(syncDailyPrices({ source, repository }, {
      stockCodes: ["5930"],
      from: "2026-09-10",
      to: "2026-09-09",
    })).rejects.toThrow("조회 기간");
    expect(repository.startRun).not.toHaveBeenCalled();
  });

  it("rejects records outside the requested range", async () => {
    const source: DailyPriceSource = {
      sourceId: "KRX_DAILY",
      fetchDailyPrices: vi.fn(async () => [{ ...validPrice, tradingDate: "2026-09-08" }]),
    };
    const repository = createRepository();

    await expect(syncDailyPrices({ source, repository }, {
      stockCodes: ["005930"],
      from: "2026-09-09",
      to: "2026-09-09",
    })).rejects.toThrow("유효하지 않은 일별 가격");
  });
});

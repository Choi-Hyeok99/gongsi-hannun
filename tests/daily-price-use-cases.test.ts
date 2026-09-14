import { describe, expect, it } from "vitest";
import type { DailyPricePoint, DailyPriceQueryRepository } from "@/domain/daily-price";
import { DataAccessError } from "@/domain/errors";
import { getDailyPriceSnapshot, getDailyPriceSnapshotOrEmpty, getDailyPriceSnapshotsOrEmpty } from "@/server/daily-price-use-cases";

class FixtureRepository implements DailyPriceQueryRepository {
  constructor(private readonly points: readonly DailyPricePoint[]) {}
  async findRecentByStockCode(): Promise<readonly DailyPricePoint[]> { return this.points; }
}

describe("getDailyPriceSnapshot", () => {
  it("sorts points and calculates the latest daily change", async () => {
    const repository = new FixtureRepository([
      { tradingDate: "2026-09-10", closePrice: 74_000, volume: 100, sourceId: "KRX_DAILY" },
      { tradingDate: "2026-09-09", closePrice: 72_500, volume: 90, sourceId: "KRX_DAILY" },
    ]);
    const result = await getDailyPriceSnapshot(repository, "005930", "1M", new Date("2026-09-14T00:00:00.000Z"));
    expect(result.status).toBe("READY");
    expect(result.latest?.tradingDate).toBe("2026-09-10");
    expect(result.sourceId).toBe("KRX_DAILY");
    expect(result.changeAmount).toBe(1_500);
    expect(result.changeRate).toBeCloseTo(2.069);
  });

  it("returns an honest empty snapshot when there are no prices", async () => {
    const result = await getDailyPriceSnapshot(new FixtureRepository([]), "005930", "3M");
    expect(result).toEqual({ status: "NO_DATA", period: "3M", points: [], latest: null, previous: null, sourceId: null, changeAmount: null, changeRate: null });
  });

  it("does not query invalid stock codes", async () => {
    let queried = false;
    const repository: DailyPriceQueryRepository = {
      async findRecentByStockCode() { queried = true; return []; },
    };
    await expect(getDailyPriceSnapshot(repository, "invalid", "1Y")).resolves.toMatchObject({ period: "1Y", points: [] });
    expect(queried).toBe(false);
  });

  it("falls back to the three month period", async () => {
    const result = await getDailyPriceSnapshot(new FixtureRepository([]), "005930", "invalid");
    expect(result.period).toBe("3M");
  });

  it("degrades a price data access failure to an empty snapshot", async () => {
    const repository: DailyPriceQueryRepository = {
      async findRecentByStockCode() { throw new DataAccessError("permission denied"); },
    };
    await expect(getDailyPriceSnapshotOrEmpty(repository, "005930", "1M")).resolves.toEqual({
      period: "1M",
      status: "ERROR",
      points: [],
      latest: null,
      previous: null,
      sourceId: null,
      changeAmount: null,
      changeRate: null,
    });
  });

  it("does not hide unexpected price failures", async () => {
    const repository: DailyPriceQueryRepository = {
      async findRecentByStockCode() { throw new Error("unexpected"); },
    };
    await expect(getDailyPriceSnapshotOrEmpty(repository, "005930", "1M")).rejects.toThrow("unexpected");
  });

  it("builds multiple snapshots from one batch repository request", async () => {
    const repository: DailyPriceQueryRepository = {
      async findRecentByStockCode() { return []; },
      async findRecentByStockCodes() {
        return {
          "005930": [
            { tradingDate: "2026-09-09", closePrice: 72_500, volume: 90, sourceId: "KRX_DAILY" },
            { tradingDate: "2026-09-10", closePrice: 74_000, volume: 100, sourceId: "KRX_DAILY" },
          ],
        };
      },
    };
    const result = await getDailyPriceSnapshotsOrEmpty(repository, ["005930", "000660"], "1M", new Date("2026-09-14T00:00:00.000Z"));
    expect(result["005930"]?.changeAmount).toBe(1_500);
    expect(result["005930"]?.status).toBe("READY");
    expect(result["000660"]?.status).toBe("NO_DATA");
    expect(result["000660"]?.points).toEqual([]);
  });

  it("keeps one real close and date while marking comparison history insufficient", async () => {
    const point = { tradingDate: "2026-09-10", closePrice: 74_000, volume: null, sourceId: "KRX_DAILY" };
    const result = await getDailyPriceSnapshot(new FixtureRepository([point]), "005930", "1M", new Date("2026-09-14T00:00:00.000Z"));

    expect(result).toMatchObject({ status: "INSUFFICIENT_HISTORY", latest: point, previous: null, changeAmount: null, changeRate: null });
  });

  it("marks old KRX data stale without discarding the actual close", async () => {
    const point = { tradingDate: "2026-08-01", closePrice: 71_000, volume: 100, sourceId: "KRX_DAILY" };
    const result = await getDailyPriceSnapshot(new FixtureRepository([point]), "005930", "1M", new Date("2026-09-14T00:00:00.000Z"));

    expect(result.status).toBe("STALE");
    expect(result.latest?.closePrice).toBe(71_000);
  });

  it("ignores points that do not come from KRX_DAILY", async () => {
    const result = await getDailyPriceSnapshot(new FixtureRepository([
      { tradingDate: "2026-09-10", closePrice: 99_999, volume: 100, sourceId: "OTHER_PROVIDER" },
    ]), "005930", "1M", new Date("2026-09-14T00:00:00.000Z"));

    expect(result.status).toBe("NO_DATA");
    expect(result.latest).toBeNull();
  });
});

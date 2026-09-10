import { describe, expect, it } from "vitest";
import type { DailyPricePoint, DailyPriceQueryRepository } from "@/domain/daily-price";
import { DataAccessError } from "@/domain/errors";
import { getDailyPriceSnapshot, getDailyPriceSnapshotOrEmpty } from "@/server/daily-price-use-cases";

class FixtureRepository implements DailyPriceQueryRepository {
  constructor(private readonly points: readonly DailyPricePoint[]) {}
  async findRecentByStockCode(): Promise<readonly DailyPricePoint[]> { return this.points; }
}

describe("getDailyPriceSnapshot", () => {
  it("sorts points and calculates the latest daily change", async () => {
    const repository = new FixtureRepository([
      { tradingDate: "2026-09-10", closePrice: 74_000, volume: 100 },
      { tradingDate: "2026-09-09", closePrice: 72_500, volume: 90 },
    ]);
    const result = await getDailyPriceSnapshot(repository, "005930", "1M");
    expect(result.latest?.tradingDate).toBe("2026-09-10");
    expect(result.changeAmount).toBe(1_500);
    expect(result.changeRate).toBeCloseTo(2.069);
  });

  it("returns an honest empty snapshot when there are no prices", async () => {
    const result = await getDailyPriceSnapshot(new FixtureRepository([]), "005930", "3M");
    expect(result).toEqual({ period: "3M", points: [], latest: null, changeAmount: null, changeRate: null });
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
      points: [],
      latest: null,
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
});

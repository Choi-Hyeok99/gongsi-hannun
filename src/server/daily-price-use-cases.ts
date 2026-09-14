import {
  DAILY_PRICE_SOURCE_ID,
  DAILY_PRICE_PERIODS,
  type DailyPricePoint,
  type DailyPricePeriod,
  type DailyPriceQueryRepository,
  type DailyPriceSnapshot,
} from "@/domain/daily-price";
import { DataAccessError } from "@/domain/errors";

const POINT_LIMITS: Readonly<Record<DailyPricePeriod, number>> = {
  "1M": 25,
  "3M": 70,
  "1Y": 260,
};
const STALE_AFTER_CALENDAR_DAYS = 7;

export async function getDailyPriceSnapshot(
  repository: DailyPriceQueryRepository,
  stockCode: string,
  rawPeriod: string | null,
  now = new Date(),
): Promise<DailyPriceSnapshot> {
  const period = parsePeriod(rawPeriod);
  if (!/^[0-9]{6}$/.test(stockCode)) return noDataSnapshot(period);

  return createSnapshot(await repository.findRecentByStockCode(stockCode, POINT_LIMITS[period]), period, now);
}

export async function getDailyPriceSnapshotOrEmpty(
  repository: DailyPriceQueryRepository,
  stockCode: string,
  rawPeriod: string | null,
  now = new Date(),
): Promise<DailyPriceSnapshot> {
  try {
    return await getDailyPriceSnapshot(repository, stockCode, rawPeriod, now);
  } catch (error) {
    if (error instanceof DataAccessError) return errorSnapshot(parsePeriod(rawPeriod));
    throw error;
  }
}

export async function getDailyPriceSnapshotsOrEmpty(
  repository: DailyPriceQueryRepository,
  stockCodes: readonly string[],
  rawPeriod: string | null,
  now = new Date(),
): Promise<Readonly<Record<string, DailyPriceSnapshot>>> {
  const period = parsePeriod(rawPeriod);
  try {
    if (!repository.findRecentByStockCodes) {
      const snapshots = await Promise.all(stockCodes.map((stockCode) => getDailyPriceSnapshotOrEmpty(repository, stockCode, period, now)));
      return Object.fromEntries(stockCodes.map((stockCode, index) => [stockCode, snapshots[index] ?? noDataSnapshot(period)]));
    }
    const grouped = await repository.findRecentByStockCodes(stockCodes, POINT_LIMITS[period]);
    return Object.fromEntries(stockCodes.map((stockCode) => [stockCode, createSnapshot(grouped[stockCode] ?? [], period, now)]));
  } catch (error) {
    if (!(error instanceof DataAccessError)) throw error;
    return Object.fromEntries(stockCodes.map((stockCode) => [stockCode, errorSnapshot(period)]));
  }
}

function createSnapshot(rawPoints: readonly DailyPricePoint[], period: DailyPricePeriod, now: Date): DailyPriceSnapshot {
  const points = [...rawPoints]
    .filter((point) => point.sourceId === DAILY_PRICE_SOURCE_ID)
    .sort((left, right) => left.tradingDate.localeCompare(right.tradingDate));
  const latest = points.at(-1) ?? null;
  const previous = points.at(-2) ?? null;
  const changeAmount = latest && previous ? latest.closePrice - previous.closePrice : null;
  const changeRate = changeAmount !== null && previous && previous.closePrice > 0
    ? (changeAmount / previous.closePrice) * 100
    : null;
  const status = !latest
    ? "NO_DATA"
    : isStale(latest.tradingDate, now)
      ? "STALE"
      : previous
        ? "READY"
        : "INSUFFICIENT_HISTORY";
  return { status, period, points, latest, previous, sourceId: latest?.sourceId ?? null, changeAmount, changeRate };
}

function parsePeriod(value: string | null): DailyPricePeriod {
  return DAILY_PRICE_PERIODS.find((period) => period === value) ?? "3M";
}

function noDataSnapshot(period: DailyPricePeriod): DailyPriceSnapshot {
  return { status: "NO_DATA", period, points: [], latest: null, previous: null, sourceId: null, changeAmount: null, changeRate: null };
}

function errorSnapshot(period: DailyPricePeriod): DailyPriceSnapshot {
  return { status: "ERROR", period, points: [], latest: null, previous: null, sourceId: null, changeAmount: null, changeRate: null };
}

function isStale(tradingDate: string, now: Date): boolean {
  const latestTime = Date.parse(`${tradingDate}T00:00:00.000Z`);
  if (!Number.isFinite(latestTime)) return true;
  return now.getTime() - latestTime > STALE_AFTER_CALENDAR_DAYS * 24 * 60 * 60 * 1_000;
}

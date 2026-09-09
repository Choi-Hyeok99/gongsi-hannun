import {
  DAILY_PRICE_PERIODS,
  type DailyPricePeriod,
  type DailyPriceQueryRepository,
  type DailyPriceSnapshot,
} from "@/domain/daily-price";

const POINT_LIMITS: Readonly<Record<DailyPricePeriod, number>> = {
  "1M": 25,
  "3M": 70,
  "1Y": 260,
};

export async function getDailyPriceSnapshot(
  repository: DailyPriceQueryRepository,
  stockCode: string,
  rawPeriod: string | null,
): Promise<DailyPriceSnapshot> {
  const period = parsePeriod(rawPeriod);
  if (!/^[0-9]{6}$/.test(stockCode)) return emptySnapshot(period);

  const points = [...await repository.findRecentByStockCode(stockCode, POINT_LIMITS[period])]
    .sort((left, right) => left.tradingDate.localeCompare(right.tradingDate));
  const latest = points.at(-1) ?? null;
  const previous = points.at(-2) ?? null;
  const changeAmount = latest && previous ? latest.closePrice - previous.closePrice : null;
  const changeRate = changeAmount !== null && previous && previous.closePrice > 0
    ? (changeAmount / previous.closePrice) * 100
    : null;

  return { period, points, latest, changeAmount, changeRate };
}

function parsePeriod(value: string | null): DailyPricePeriod {
  return DAILY_PRICE_PERIODS.find((period) => period === value) ?? "3M";
}

function emptySnapshot(period: DailyPricePeriod): DailyPriceSnapshot {
  return { period, points: [], latest: null, changeAmount: null, changeRate: null };
}

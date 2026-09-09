export type DailyPriceRecord = Readonly<{
  stockCode: string;
  tradingDate: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string;
}>;

export type DailyPriceRange = Readonly<{
  stockCodes: readonly string[];
  from: string;
  to: string;
}>;

export type DailyPriceSyncCounts = Readonly<{
  readCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
}>;

export interface DailyPriceSource {
  readonly sourceId: string;
  fetchDailyPrices(range: DailyPriceRange): Promise<readonly DailyPriceRecord[]>;
}

export interface DailyPriceSyncRepository {
  startRun(range: Pick<DailyPriceRange, "from" | "to">, sourceId: string): Promise<string>;
  upsertDailyPrices(
    runId: string,
    sourceId: string,
    prices: readonly DailyPriceRecord[],
  ): Promise<Readonly<{ createdCount: number; updatedCount: number; failedCount: number }>>;
  completeRun(runId: string, counts: DailyPriceSyncCounts): Promise<void>;
  failRun(runId: string, readCount: number, error: unknown): Promise<void>;
}

export const DAILY_PRICE_PERIODS = ["1M", "3M", "1Y"] as const;
export type DailyPricePeriod = (typeof DAILY_PRICE_PERIODS)[number];

export type DailyPricePoint = Readonly<{
  tradingDate: string;
  closePrice: number;
  volume: number;
}>;

export type DailyPriceSnapshot = Readonly<{
  period: DailyPricePeriod;
  points: readonly DailyPricePoint[];
  latest: DailyPricePoint | null;
  changeAmount: number | null;
  changeRate: number | null;
}>;

export interface DailyPriceQueryRepository {
  findRecentByStockCode(stockCode: string, limit: number): Promise<readonly DailyPricePoint[]>;
}

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

export interface DailyPriceTargetRepository {
  listActiveStockCodes(): Promise<readonly string[]>;
}

export const DAILY_PRICE_PERIODS = ["1W", "1M", "3M", "1Y"] as const;
export type DailyPricePeriod = (typeof DAILY_PRICE_PERIODS)[number];
export const DAILY_PRICE_SOURCE_ID = "KRX_DAILY";
export type DailyPriceStatus = "READY" | "NO_DATA" | "INSUFFICIENT_HISTORY" | "STALE" | "ERROR";

export type DailyPricePoint = Readonly<{
  tradingDate: string;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  closePrice: number;
  volume: number | null;
  sourceId: string;
}>;

export type DailyPriceSnapshot = Readonly<{
  status: DailyPriceStatus;
  period: DailyPricePeriod;
  points: readonly DailyPricePoint[];
  latest: DailyPricePoint | null;
  previous: DailyPricePoint | null;
  sourceId: string | null;
  changeAmount: number | null;
  changeRate: number | null;
}>;

export interface DailyPriceQueryRepository {
  findRecentByStockCode(stockCode: string, limit: number): Promise<readonly DailyPricePoint[]>;
  findRecentByStockCodes?(
    stockCodes: readonly string[],
    limitPerStock: number,
  ): Promise<Readonly<Record<string, readonly DailyPricePoint[]>>>;
}

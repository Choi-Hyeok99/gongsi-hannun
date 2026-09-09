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

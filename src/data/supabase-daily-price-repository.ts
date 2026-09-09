import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  DailyPriceRange,
  DailyPriceRecord,
  DailyPriceSyncCounts,
  DailyPriceSyncRepository,
} from "@/domain/daily-price";
import { DataAccessError } from "@/domain/errors";

const BATCH_SIZE = 500;

type RepositoryOptions = Readonly<{
  supabaseUrl: string;
  supabaseSecretKey: string;
}>;

type CompanyRow = Readonly<{ id: string; stock_code: string }>;

export class SupabaseDailyPriceRepository implements DailyPriceSyncRepository {
  constructor(private readonly client: SupabaseClient) {}

  async startRun(range: Pick<DailyPriceRange, "from" | "to">, sourceId: string): Promise<string> {
    const { data, error } = await this.client
      .from("ingestion_runs")
      .insert({
        job_type: "DAILY_PRICE_SYNC",
        status: "RUNNING",
        range_start: `${range.from}T00:00:00+09:00`,
        range_end: `${range.to}T23:59:59+09:00`,
        metadata: { source: sourceId },
      })
      .select("id")
      .single();
    if (error || !data) throw new DataAccessError("일별 주가 수집 실행 기록을 만들지 못했습니다.");
    return String(data.id);
  }

  async upsertDailyPrices(
    runId: string,
    sourceId: string,
    prices: readonly DailyPriceRecord[],
  ): Promise<Readonly<{ createdCount: number; updatedCount: number; failedCount: number }>> {
    if (prices.length === 0) return { createdCount: 0, updatedCount: 0, failedCount: 0 };

    const companies = await this.loadCompanies(prices.map((price) => price.stockCode));
    const companyByStockCode = new Map(companies.map((company) => [company.stock_code, company.id]));
    const matched = prices.filter((price) => companyByStockCode.has(price.stockCode));
    const failedCount = prices.length - matched.length;
    const existingKeys = await this.loadExistingKeys(sourceId, matched, companyByStockCode);

    for (const batch of batches(matched, BATCH_SIZE)) {
      const rows = batch.map((price) => ({
        company_id: companyByStockCode.get(price.stockCode),
        ingestion_run_id: runId,
        source: sourceId,
        trading_date: price.tradingDate,
        currency: "KRW",
        open_price: price.openPrice,
        high_price: price.highPrice,
        low_price: price.lowPrice,
        close_price: price.closePrice,
        volume: price.volume,
      }));
      const { error } = await this.client
        .from("daily_prices")
        .upsert(rows, { onConflict: "company_id,source,trading_date" });
      if (error) throw new DataAccessError("일별 주가를 저장하지 못했습니다.");
    }

    const updatedCount = matched.filter((price) => {
      const companyId = companyByStockCode.get(price.stockCode);
      return companyId !== undefined && existingKeys.has(`${companyId}:${price.tradingDate}`);
    }).length;
    return { createdCount: matched.length - updatedCount, updatedCount, failedCount };
  }

  async completeRun(runId: string, counts: DailyPriceSyncCounts): Promise<void> {
    const status = counts.failedCount > 0 ? "PARTIAL" : "SUCCEEDED";
    const { error } = await this.client
      .from("ingestion_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        read_count: counts.readCount,
        created_count: counts.createdCount,
        updated_count: counts.updatedCount,
        failed_count: counts.failedCount,
      })
      .eq("id", runId);
    if (error) throw new DataAccessError("일별 주가 수집 완료 기록을 저장하지 못했습니다.");
  }

  async failRun(runId: string, readCount: number, error: unknown): Promise<void> {
    const safeMessage = error instanceof Error ? error.message.slice(0, 2_000) : "알 수 없는 오류";
    await this.client
      .from("ingestion_runs")
      .update({
        status: "FAILED",
        finished_at: new Date().toISOString(),
        read_count: readCount,
        failed_count: 1,
        error_code: error instanceof Error && "code" in error ? String(error.code).slice(0, 100) : "UNKNOWN",
        error_message: safeMessage,
      })
      .eq("id", runId);
  }

  private async loadCompanies(stockCodes: readonly string[]): Promise<readonly CompanyRow[]> {
    const rows: CompanyRow[] = [];
    for (const batch of batches([...new Set(stockCodes)], BATCH_SIZE)) {
      const { data, error } = await this.client
        .from("companies")
        .select("id,stock_code")
        .in("stock_code", batch)
        .eq("is_active", true)
        .eq("is_listed", true);
      if (error) throw new DataAccessError("주가 대상 기업을 확인하지 못했습니다.");
      for (const row of data ?? []) {
        if (row.stock_code) rows.push({ id: String(row.id), stock_code: String(row.stock_code) });
      }
    }
    return rows;
  }

  private async loadExistingKeys(
    sourceId: string,
    prices: readonly DailyPriceRecord[],
    companyByStockCode: ReadonlyMap<string, string>,
  ): Promise<ReadonlySet<string>> {
    const keys = new Set<string>();
    for (const batch of batches(prices, BATCH_SIZE)) {
      const companyIds = batch.flatMap((price) => {
        const id = companyByStockCode.get(price.stockCode);
        return id ? [id] : [];
      });
      const dates = [...new Set(batch.map((price) => price.tradingDate))];
      const { data, error } = await this.client
        .from("daily_prices")
        .select("company_id,trading_date")
        .eq("source", sourceId)
        .in("company_id", companyIds)
        .in("trading_date", dates);
      if (error) throw new DataAccessError("기존 일별 주가를 확인하지 못했습니다.");
      for (const row of data ?? []) keys.add(`${row.company_id}:${row.trading_date}`);
    }
    return keys;
  }
}

export function createSupabaseDailyPriceRepository(options: RepositoryOptions): DailyPriceSyncRepository {
  const client = createClient(options.supabaseUrl, options.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return new SupabaseDailyPriceRepository(client);
}

function batches<T>(values: readonly T[], size: number): readonly T[][] {
  const result: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    result.push(values.slice(offset, offset + size));
  }
  return result;
}

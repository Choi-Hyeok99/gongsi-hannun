import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DailyPricePoint, DailyPriceQueryRepository } from "@/domain/daily-price";
import { DataAccessError } from "@/domain/errors";
import { readServerEnvironment } from "@/server/env";

type DailyPriceRow = Readonly<{
  trading_date: string;
  close_price: string | number;
  volume: string | number;
}>;

export class SupabaseDailyPriceQueryRepository implements DailyPriceQueryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findRecentByStockCode(stockCode: string, limit: number): Promise<readonly DailyPricePoint[]> {
    const { data: latest, error: latestError } = await this.client
      .from("daily_prices")
      .select("source,companies!inner(stock_code)")
      .eq("companies.stock_code", stockCode)
      .order("trading_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw new DataAccessError("일별 주가를 조회하지 못했습니다.");
    if (!latest) return [];
    const sourceId = String(latest.source);

    const { data, error } = await this.client
      .from("daily_prices")
      .select("trading_date,close_price,volume,companies!inner(stock_code)")
      .eq("source", sourceId)
      .eq("companies.stock_code", stockCode)
      .order("trading_date", { ascending: false })
      .limit(limit);
    if (error) throw new DataAccessError("일별 주가를 조회하지 못했습니다.");
    return ((data ?? []) as unknown as DailyPriceRow[]).map((row) => ({
      tradingDate: row.trading_date,
      closePrice: Number(row.close_price),
      volume: Number(row.volume),
      sourceId,
    }));
  }
}

export function createDailyPriceQueryRepository(): DailyPriceQueryRepository {
  const environment = readServerEnvironment();
  return new SupabaseDailyPriceQueryRepository(
    createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  );
}

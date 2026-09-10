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

type BatchDailyPriceRow = DailyPriceRow & Readonly<{
  source: string;
  companies: { stock_code: string } | readonly { stock_code: string }[];
}>;

const OFFICIAL_DAILY_SOURCE = "KRX_DAILY";

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

  async findRecentByStockCodes(
    stockCodes: readonly string[],
    limitPerStock: number,
  ): Promise<Readonly<Record<string, readonly DailyPricePoint[]>>> {
    if (stockCodes.length === 0) return {};
    const { data, error } = await this.client
      .from("daily_prices")
      .select("trading_date,close_price,volume,source,companies!inner(stock_code)")
      .eq("source", OFFICIAL_DAILY_SOURCE)
      .in("companies.stock_code", [...stockCodes])
      .order("trading_date", { ascending: false })
      .limit(stockCodes.length * limitPerStock);
    if (error) throw new DataAccessError("일별 주가를 조회하지 못했습니다.");

    const grouped: Record<string, DailyPricePoint[]> = Object.fromEntries(stockCodes.map((code) => [code, []]));
    for (const row of (data ?? []) as unknown as BatchDailyPriceRow[]) {
      const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
      const stockCode = company?.stock_code;
      if (!stockCode || !grouped[stockCode] || grouped[stockCode].length >= limitPerStock) continue;
      grouped[stockCode].push({
        tradingDate: row.trading_date,
        closePrice: Number(row.close_price),
        volume: Number(row.volume),
        sourceId: row.source,
      });
    }
    return grouped;
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

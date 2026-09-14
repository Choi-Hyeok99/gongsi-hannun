import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DAILY_PRICE_SOURCE_ID, type DailyPricePoint, type DailyPriceQueryRepository } from "@/domain/daily-price";
import { DataAccessError } from "@/domain/errors";
import { readServerEnvironment } from "@/server/env";

type DailyPriceRow = Readonly<{
  trading_date: string;
  open_price: string | number | null;
  high_price: string | number | null;
  low_price: string | number | null;
  close_price: string | number | null;
  volume: string | number | null;
}>;

type BatchDailyPriceRow = DailyPriceRow & Readonly<{
  source: string;
  companies: { stock_code: string } | readonly { stock_code: string }[];
}>;

export class SupabaseDailyPriceQueryRepository implements DailyPriceQueryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findRecentByStockCode(stockCode: string, limit: number): Promise<readonly DailyPricePoint[]> {
    const { data, error } = await this.client
      .from("daily_prices")
      .select("trading_date,open_price,high_price,low_price,close_price,volume,companies!inner(stock_code)")
      .eq("source", DAILY_PRICE_SOURCE_ID)
      .eq("companies.stock_code", stockCode)
      .order("trading_date", { ascending: false })
      .limit(limit);
    if (error) throw new DataAccessError("일별 주가를 조회하지 못했습니다.");
    return ((data ?? []) as unknown as DailyPriceRow[]).flatMap((row) => {
      const point = mapDailyPricePoint(row);
      return point ? [point] : [];
    });
  }

  async findRecentByStockCodes(
    stockCodes: readonly string[],
    limitPerStock: number,
  ): Promise<Readonly<Record<string, readonly DailyPricePoint[]>>> {
    if (stockCodes.length === 0) return {};
    const { data, error } = await this.client
      .from("daily_prices")
      .select("trading_date,open_price,high_price,low_price,close_price,volume,source,companies!inner(stock_code)")
      .eq("source", DAILY_PRICE_SOURCE_ID)
      .in("companies.stock_code", [...stockCodes])
      .order("trading_date", { ascending: false })
      .limit(stockCodes.length * limitPerStock);
    if (error) throw new DataAccessError("일별 주가를 조회하지 못했습니다.");

    const grouped: Record<string, DailyPricePoint[]> = Object.fromEntries(stockCodes.map((code) => [code, []]));
    for (const row of (data ?? []) as unknown as BatchDailyPriceRow[]) {
      const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
      const stockCode = company?.stock_code;
      if (!stockCode || !grouped[stockCode] || grouped[stockCode].length >= limitPerStock) continue;
      const point = mapDailyPricePoint(row);
      if (point) grouped[stockCode].push(point);
    }
    return grouped;
  }
}

function mapDailyPricePoint(row: DailyPriceRow): DailyPricePoint | null {
  const closePrice = parseNumericValue(row.close_price);
  if (closePrice === null) return null;
  return {
    tradingDate: row.trading_date,
    openPrice: parseNumericValue(row.open_price) ?? undefined,
    highPrice: parseNumericValue(row.high_price) ?? undefined,
    lowPrice: parseNumericValue(row.low_price) ?? undefined,
    closePrice,
    volume: parseNumericValue(row.volume),
    sourceId: DAILY_PRICE_SOURCE_ID,
  };
}

function parseNumericValue(value: string | number | null): number | null {
  if (value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createDailyPriceQueryRepository(): DailyPriceQueryRepository {
  const environment = readServerEnvironment();
  return new SupabaseDailyPriceQueryRepository(
    createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  );
}

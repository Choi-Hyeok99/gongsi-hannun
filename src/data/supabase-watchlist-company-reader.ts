import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { WatchlistCompany, WatchlistCompanyReader } from "@/domain/watchlist";
import { DataAccessError } from "@/domain/errors";
import { readServerEnvironment } from "@/server/env";

type CompanyRow = Readonly<{
  id: string;
  stock_code: string;
  name_ko: string;
  market: string;
  sector: string | null;
}>;

function mapCompany(row: CompanyRow): WatchlistCompany {
  return { id: row.id, stockCode: row.stock_code, name: row.name_ko, market: row.market, sector: row.sector };
}

export class SupabaseWatchlistCompanyReader implements WatchlistCompanyReader {
  constructor(private readonly client: SupabaseClient) {}

  async findByIds(companyIds: readonly string[]): Promise<readonly WatchlistCompany[]> {
    if (companyIds.length === 0) return [];
    const { data, error } = await this.client
      .from("companies")
      .select("id,stock_code,name_ko,market,sector")
      .in("id", [...companyIds])
      .eq("is_active", true);
    if (error) throw new DataAccessError("관심기업 정보를 불러오지 못했습니다.");
    const companies = (data as CompanyRow[]).map(mapCompany);
    const order = new Map(companyIds.map((id, index) => [id, index]));
    return companies.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  }

  async findByStockCode(stockCode: string): Promise<WatchlistCompany | null> {
    const { data, error } = await this.client
      .from("companies")
      .select("id,stock_code,name_ko,market,sector")
      .eq("stock_code", stockCode)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new DataAccessError("기업 정보를 확인하지 못했습니다.");
    return data ? mapCompany(data as CompanyRow) : null;
  }
}

export function createWatchlistCompanyReader(): WatchlistCompanyReader {
  const environment = readServerEnvironment();
  return new SupabaseWatchlistCompanyReader(createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

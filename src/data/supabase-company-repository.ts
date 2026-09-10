import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Company, CompanyIndustryCategory, CompanyPage, CompanyRepository, Market } from "@/domain/company";
import { DataAccessError } from "@/domain/errors";
import { readServerEnvironment } from "@/server/env";

type CompanyRow = { id: string; dart_corp_code: string; stock_code: string; name_ko: string; market: Market; sector: string | null; industry_category: CompanyIndustryCategory };

function mapCompany(row: CompanyRow): Company {
  return { id: row.id, dartCorpCode: row.dart_corp_code, stockCode: row.stock_code, nameKo: row.name_ko, market: row.market, sector: row.sector, industryCategory: row.industry_category };
}

export class SupabaseCompanyRepository implements CompanyRepository {
  constructor(private readonly client: SupabaseClient) {}

  async search(query: string, limit: number, category?: CompanyIndustryCategory): Promise<readonly Company[]> {
    const normalized = query.replaceAll("%", "\\%").replaceAll("_", "\\_");
    let baseQuery = this.client.from("companies").select("id,dart_corp_code,stock_code,name_ko,market,sector,industry_category").eq("is_active", true).order("name_ko").limit(limit);
    if (category) baseQuery = baseQuery.eq("industry_category", category);
    const request = /^[0-9]{6}$/.test(query)
      ? baseQuery.eq("stock_code", query)
      : baseQuery.ilike("name_ko", `${normalized}%`);
    const { data, error } = await request;
    if (error) throw new DataAccessError("기업 정보를 조회하지 못했습니다.");
    return (data as CompanyRow[]).map(mapCompany);
  }

  async searchPage(query: string, limit: number, offset: number, category?: CompanyIndustryCategory): Promise<CompanyPage> {
    const normalized = query.replaceAll("%", "\\%").replaceAll("_", "\\_");
    let baseQuery = this.client
      .from("companies")
      .select("id,dart_corp_code,stock_code,name_ko,market,sector,industry_category", { count: "exact" })
      .eq("is_active", true)
      .order("name_ko")
      .range(offset, offset + limit - 1);
    if (category) baseQuery = baseQuery.eq("industry_category", category);
    const request = !query
      ? baseQuery
      : /^[0-9]{6}$/.test(query)
        ? baseQuery.eq("stock_code", query)
        : baseQuery.ilike("name_ko", `${normalized}%`);
    const { data, error, count } = await request;
    if (error) throw new DataAccessError("기업 정보를 조회하지 못했습니다.");
    return { companies: (data as CompanyRow[]).map(mapCompany), total: count ?? 0 };
  }

  async findByStockCode(stockCode: string): Promise<Company | null> {
    const { data, error } = await this.client.from("companies").select("id,dart_corp_code,stock_code,name_ko,market,sector,industry_category").eq("is_active", true).eq("stock_code", stockCode).maybeSingle();
    if (error) throw new DataAccessError("기업 정보를 조회하지 못했습니다.");
    return data ? mapCompany(data as CompanyRow) : null;
  }
}

export function createCompanyRepository(): CompanyRepository {
  const env = readServerEnvironment();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return new SupabaseCompanyRepository(client);
}

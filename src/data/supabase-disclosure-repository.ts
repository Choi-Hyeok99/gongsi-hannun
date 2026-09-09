import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Market } from "@/domain/company";
import type { DisclosureRepository, DisclosureSummary } from "@/domain/disclosure-query";
import { DataAccessError } from "@/domain/errors";
import { readServerEnvironment } from "@/server/env";

type DisclosureRow = {
  receipt_no: string;
  report_name: string;
  filer_name: string | null;
  disclosed_on: string;
  original_url: string;
  disclosure_status: DisclosureSummary["status"];
  companies: {
    stock_code: string;
    name_ko: string;
    market: Market;
  };
};

const SELECTION = "receipt_no,report_name,filer_name,disclosed_on,original_url,disclosure_status,companies!inner(stock_code,name_ko,market)";

function mapDisclosure(row: DisclosureRow): DisclosureSummary {
  return {
    receiptNumber: row.receipt_no,
    reportName: row.report_name,
    filerName: row.filer_name,
    disclosedOn: row.disclosed_on,
    originalUrl: row.original_url,
    status: row.disclosure_status,
    company: {
      stockCode: row.companies.stock_code,
      name: row.companies.name_ko,
      market: row.companies.market,
    },
  };
}

export class SupabaseDisclosureRepository implements DisclosureRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findLatest(limit: number): Promise<readonly DisclosureSummary[]> {
    const { data, error } = await this.client
      .from("source_disclosures")
      .select(SELECTION)
      .order("disclosed_on", { ascending: false })
      .order("receipt_no", { ascending: false })
      .limit(limit);
    if (error) throw new DataAccessError("최근 공시를 조회하지 못했습니다.");
    return (data as unknown as DisclosureRow[]).map(mapDisclosure);
  }

  async findByReceiptNumber(receiptNumber: string): Promise<DisclosureSummary | null> {
    const { data, error } = await this.client
      .from("source_disclosures")
      .select(SELECTION)
      .eq("receipt_no", receiptNumber)
      .maybeSingle();
    if (error) throw new DataAccessError("공시 상세 정보를 조회하지 못했습니다.");
    return data ? mapDisclosure(data as unknown as DisclosureRow) : null;
  }

  async findByCompanyStockCode(stockCode: string, limit: number): Promise<readonly DisclosureSummary[]> {
    const { data, error } = await this.client
      .from("source_disclosures")
      .select(SELECTION)
      .eq("companies.stock_code", stockCode)
      .order("disclosed_on", { ascending: false })
      .order("receipt_no", { ascending: false })
      .limit(limit);
    if (error) throw new DataAccessError("기업 공시를 조회하지 못했습니다.");
    return (data as unknown as DisclosureRow[]).map(mapDisclosure);
  }
}

export function createDisclosureRepository(): DisclosureRepository {
  const env = readServerEnvironment();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return new SupabaseDisclosureRepository(client);
}

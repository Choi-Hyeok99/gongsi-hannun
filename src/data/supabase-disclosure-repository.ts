import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Market } from "@/domain/company";
import type { DisclosureEventType } from "@/domain/disclosure-classification";
import type {
  DisclosureRepository,
  DisclosureSearch,
  DisclosureSearchResult,
  DisclosureSummary,
} from "@/domain/disclosure-query";
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
  events: { event_type: DisclosureEventType; visibility: "PUBLIC" } | readonly { event_type: DisclosureEventType; visibility: "PUBLIC" }[];
};

const SELECTION = "receipt_no,report_name,filer_name,disclosed_on,original_url,disclosure_status,companies!inner(stock_code,name_ko,market),events!inner(event_type,visibility)";

function mapDisclosure(row: DisclosureRow): DisclosureSummary {
  const event = Array.isArray(row.events) ? row.events[0] : row.events;
  if (!event) throw new DataAccessError("공개 공시 이벤트 분류가 올바르지 않습니다.");
  return {
    receiptNumber: row.receipt_no,
    reportName: row.report_name,
    filerName: row.filer_name,
    disclosedOn: row.disclosed_on,
    originalUrl: row.original_url,
    status: row.disclosure_status,
    eventType: event.event_type,
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
    const result = await this.search({ date: null, eventType: null, term: null, page: 1, pageSize: limit });
    return result.items;
  }

  async search(query: DisclosureSearch): Promise<DisclosureSearchResult> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const companyIds = query.term ? await this.findMatchingCompanyIds(query.term) : [];
    let request = this.client
      .from("source_disclosures")
      .select(SELECTION, { count: "exact" })
      .eq("events.visibility", "PUBLIC")
      .order("disclosed_on", { ascending: false })
      .order("receipt_no", { ascending: false })
      .range(from, to);
    if (query.date) request = request.eq("disclosed_on", query.date);
    if (query.eventType) request = request.eq("events.event_type", query.eventType);
    if (query.term) {
      const reportFilter = `report_name.ilike.%${query.term}%`;
      request = companyIds.length > 0
        ? request.or(`${reportFilter},company_id.in.(${companyIds.join(",")})`)
        : request.ilike("report_name", `%${query.term}%`);
    }
    const { data, error, count } = await request;
    if (error) throw new DataAccessError("공시 목록을 조회하지 못했습니다.");
    return {
      items: (data as unknown as DisclosureRow[]).map(mapDisclosure),
      totalCount: count ?? 0,
    };
  }

  async findByReceiptNumber(receiptNumber: string): Promise<DisclosureSummary | null> {
    const { data, error } = await this.client
      .from("source_disclosures")
      .select(SELECTION)
      .eq("receipt_no", receiptNumber)
      .eq("events.visibility", "PUBLIC")
      .maybeSingle();
    if (error) throw new DataAccessError("공시 상세 정보를 조회하지 못했습니다.");
    return data ? mapDisclosure(data as unknown as DisclosureRow) : null;
  }

  async findByCompanyStockCode(stockCode: string, limit: number): Promise<readonly DisclosureSummary[]> {
    const { data, error } = await this.client
      .from("source_disclosures")
      .select(SELECTION)
      .eq("companies.stock_code", stockCode)
      .eq("events.visibility", "PUBLIC")
      .order("disclosed_on", { ascending: false })
      .order("receipt_no", { ascending: false })
      .limit(limit);
    if (error) throw new DataAccessError("기업 공시를 조회하지 못했습니다.");
    return (data as unknown as DisclosureRow[]).map(mapDisclosure);
  }

  async findByDateRange(from: string, to: string, pageSize: number): Promise<readonly DisclosureSummary[]> {
    const items: DisclosureSummary[] = [];
    const size = Math.max(1, Math.min(Math.trunc(pageSize) || 300, 1_000));
    for (let offset = 0; ; offset += size) {
      const { data, error } = await this.client
        .from("source_disclosures")
        .select(SELECTION)
        .eq("events.visibility", "PUBLIC")
        .neq("events.event_type", "OTHER")
        .gte("events.rule_importance_score", 70)
        .gte("disclosed_on", from)
        .lte("disclosed_on", to)
        .order("disclosed_on", { ascending: true })
        .order("receipt_no", { ascending: true })
        .range(offset, offset + size - 1);
      if (error) throw new DataAccessError("공시 일정을 조회하지 못했습니다.");
      const rows = (data ?? []) as unknown as DisclosureRow[];
      items.push(...rows.map(mapDisclosure));
      if (rows.length < size) return items;
    }
  }

  private async findMatchingCompanyIds(term: string): Promise<readonly string[]> {
    const escaped = term.replaceAll("%", "\\%").replaceAll("_", "\\_");
    const { data, error } = await this.client
      .from("companies")
      .select("id")
      .ilike("name_ko", `%${escaped}%`)
      .limit(200);
    if (error) throw new DataAccessError("공시 기업명 검색을 수행하지 못했습니다.");
    return (data ?? []).map((row) => String(row.id));
  }
}

export function createDisclosureRepository(): DisclosureRepository {
  const env = readServerEnvironment();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return new SupabaseDisclosureRepository(client);
}

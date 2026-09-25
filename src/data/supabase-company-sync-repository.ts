import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CompanySyncCounts,
  CompanySyncRepository,
  ListedCompanyInput,
} from "@/domain/company-sync";
import { DataAccessError } from "@/domain/errors";

const BATCH_SIZE = 500;

type ExistingCompanyState = Readonly<{
  dart_corp_code: string;
  market: "KOSPI" | "KOSDAQ" | "KONEX" | "OTHER";
  is_listed: boolean;
  is_active: boolean;
}>;

type RepositoryOptions = Readonly<{
  supabaseUrl: string;
  supabaseSecretKey: string;
}>;

export class SupabaseCompanySyncRepository implements CompanySyncRepository {
  constructor(private readonly client: SupabaseClient) {}

  async startRun(): Promise<string> {
    const { data, error } = await this.client
      .from("ingestion_runs")
      .insert({ job_type: "COMPANY_SYNC", status: "RUNNING" })
      .select("id")
      .single();
    if (error || !data) throw new DataAccessError("기업 동기화 실행 기록을 만들지 못했습니다.");
    return String(data.id);
  }

  async upsertListedCompanies(
    companies: readonly ListedCompanyInput[],
  ): Promise<Readonly<{ createdCount: number; updatedCount: number }>> {
    const existingByCode = new Map<string, ExistingCompanyState>();
    for (const batch of batches(companies, BATCH_SIZE)) {
      const { data, error } = await this.client
        .from("companies")
        .select("dart_corp_code,market,is_listed,is_active")
        .in("dart_corp_code", batch.map((company) => company.dartCorpCode));
      if (error) throw new DataAccessError("기존 기업 정보를 확인하지 못했습니다.");
      for (const row of data ?? []) {
        const existing = row as ExistingCompanyState;
        existingByCode.set(existing.dart_corp_code, existing);
      }
    }

    for (const batch of batches(companies, BATCH_SIZE)) {
      const rows = batch.map((company) => {
        const existing = existingByCode.get(company.dartCorpCode);
        return {
          dart_corp_code: company.dartCorpCode,
          stock_code: company.stockCode,
          name_ko: company.nameKo,
          name_en: company.nameEn,
          market: existing?.market ?? "OTHER",
          // A stock code in corpCode.xml alone does not prove a current listing.
          // New rows stay hidden until company.json verifies Y/K/N. Existing rows
          // retain the result of their latest verified company overview.
          is_listed: existing?.is_listed ?? false,
          is_active: existing?.is_active ?? false,
          source_updated_at: `${company.sourceUpdatedOn}T00:00:00+09:00`,
        };
      });
      const { error } = await this.client
        .from("companies")
        .upsert(rows, { onConflict: "dart_corp_code" });
      if (error) throw new DataAccessError("기업 정보를 저장하지 못했습니다.");
    }

    const updatedCount = companies.filter((company) => existingByCode.has(company.dartCorpCode)).length;
    return { createdCount: companies.length - updatedCount, updatedCount };
  }

  async completeRun(runId: string, counts: CompanySyncCounts): Promise<void> {
    const { error } = await this.client
      .from("ingestion_runs")
      .update({
        status: "SUCCEEDED",
        finished_at: new Date().toISOString(),
        read_count: counts.readCount,
        created_count: counts.createdCount,
        updated_count: counts.updatedCount,
      })
      .eq("id", runId);
    if (error) throw new DataAccessError("기업 동기화 완료 기록을 저장하지 못했습니다.");
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
}

export function createSupabaseCompanySyncRepository(options: RepositoryOptions): CompanySyncRepository {
  const client = createClient(options.supabaseUrl, options.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return new SupabaseCompanySyncRepository(client);
}

function batches<T>(values: readonly T[], size: number): readonly T[][] {
  const result: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    result.push(values.slice(offset, offset + size));
  }
  return result;
}

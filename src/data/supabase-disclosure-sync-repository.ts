import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  DisclosureRecord,
  DisclosureSyncCounts,
  DisclosureSyncRepository,
} from "@/domain/disclosure";
import { marketFromCorpClass } from "@/domain/disclosure";
import { DataAccessError } from "@/domain/errors";

const BATCH_SIZE = 300;
const CORRECTION_MARKER = /^\[(기재정정|첨부정정|첨부추가|연장결정|철회|취소)\]/;

type RepositoryOptions = Readonly<{
  supabaseUrl: string;
  supabaseSecretKey: string;
}>;

type CompanyRow = Readonly<{ id: string; dart_corp_code: string }>;

export class SupabaseDisclosureSyncRepository implements DisclosureSyncRepository {
  constructor(private readonly client: SupabaseClient) {}

  async startRun(fromDate: string, toDate: string): Promise<string> {
    const { data, error } = await this.client
      .from("ingestion_runs")
      .insert({
        job_type: "DISCLOSURE_COLLECT",
        status: "RUNNING",
        range_start: toKstStart(fromDate),
        range_end: toKstEnd(toDate),
      })
      .select("id")
      .single();
    if (error || !data) throw new DataAccessError("공시 수집 실행 기록을 만들지 못했습니다.");
    return String(data.id);
  }

  async upsertDisclosures(records: readonly DisclosureRecord[]): Promise<DisclosureSyncCounts> {
    if (records.length === 0) {
      return { readCount: 0, createdCount: 0, updatedCount: 0, failedCount: 0 };
    }

    const companyByCorpCode = await this.loadCompanies(records);
    const existingReceiptNumbers = await this.loadExistingReceiptNumbers(records);
    const matched = records.filter((record) => companyByCorpCode.has(record.dartCorpCode));

    for (const batch of batches(matched, BATCH_SIZE)) {
      const rows = batch.map((record) => ({
        company_id: companyByCorpCode.get(record.dartCorpCode),
        source: "OPENDART",
        receipt_no: record.receiptNumber,
        report_name: record.reportName,
        filer_name: record.filerName,
        disclosed_on: record.disclosedOn,
        original_url: record.originalUrl,
        raw_metadata: {
          corpClass: record.corpClass,
          remarks: record.remarks,
          stockCode: record.stockCode,
        },
        disclosure_status: CORRECTION_MARKER.test(record.reportName) ? "REVIEW_REQUIRED" : "ACTIVE",
      }));
      const { error } = await this.client
        .from("source_disclosures")
        .upsert(rows, { onConflict: "source,receipt_no" });
      if (error) throw new DataAccessError("공시 정보를 저장하지 못했습니다.");
    }

    await this.updateKnownMarkets(matched);

    const updatedCount = matched.filter((record) =>
      existingReceiptNumbers.has(record.receiptNumber),
    ).length;
    return {
      readCount: records.length,
      createdCount: matched.length - updatedCount,
      updatedCount,
      failedCount: records.length - matched.length,
    };
  }

  async completeRun(runId: string, counts: DisclosureSyncCounts): Promise<void> {
    const { error } = await this.client
      .from("ingestion_runs")
      .update({
        status: counts.failedCount > 0 ? "PARTIAL" : "SUCCEEDED",
        finished_at: new Date().toISOString(),
        read_count: counts.readCount,
        created_count: counts.createdCount,
        updated_count: counts.updatedCount,
        failed_count: counts.failedCount,
      })
      .eq("id", runId);
    if (error) throw new DataAccessError("공시 수집 완료 기록을 저장하지 못했습니다.");
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

  private async loadCompanies(records: readonly DisclosureRecord[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const corpCodes = [...new Set(records.map((record) => record.dartCorpCode))];
    for (const batch of batches(corpCodes, BATCH_SIZE)) {
      const { data, error } = await this.client
        .from("companies")
        .select("id,dart_corp_code")
        .in("dart_corp_code", batch);
      if (error) throw new DataAccessError("공시 대상 기업을 확인하지 못했습니다.");
      for (const row of (data ?? []) as CompanyRow[]) result.set(row.dart_corp_code, row.id);
    }
    return result;
  }

  private async loadExistingReceiptNumbers(records: readonly DisclosureRecord[]): Promise<Set<string>> {
    const result = new Set<string>();
    const receiptNumbers = records.map((record) => record.receiptNumber);
    for (const batch of batches(receiptNumbers, BATCH_SIZE)) {
      const { data, error } = await this.client
        .from("source_disclosures")
        .select("receipt_no")
        .eq("source", "OPENDART")
        .in("receipt_no", batch);
      if (error) throw new DataAccessError("기존 공시를 확인하지 못했습니다.");
      for (const row of data ?? []) result.add(String(row.receipt_no));
    }
    return result;
  }

  private async updateKnownMarkets(records: readonly DisclosureRecord[]): Promise<void> {
    for (const corpClass of ["Y", "K", "N"] as const) {
      const corpCodes = [...new Set(
        records.filter((record) => record.corpClass === corpClass).map((record) => record.dartCorpCode),
      )];
      for (const batch of batches(corpCodes, BATCH_SIZE)) {
        const { error } = await this.client
          .from("companies")
          .update({ market: marketFromCorpClass(corpClass) })
          .in("dart_corp_code", batch);
        if (error) throw new DataAccessError("기업 시장 분류를 갱신하지 못했습니다.");
      }
    }
  }
}

export function createSupabaseDisclosureSyncRepository(
  options: RepositoryOptions,
): DisclosureSyncRepository {
  return new SupabaseDisclosureSyncRepository(
    createClient(options.supabaseUrl, options.supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  );
}

function batches<T>(values: readonly T[], size: number): readonly T[][] {
  const result: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    result.push(values.slice(offset, offset + size));
  }
  return result;
}

function toKstStart(value: string): string {
  return new Date(`${formatDate(value)}T00:00:00+09:00`).toISOString();
}

function toKstEnd(value: string): string {
  return new Date(`${formatDate(value)}T23:59:59.999+09:00`).toISOString();
}

function formatDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

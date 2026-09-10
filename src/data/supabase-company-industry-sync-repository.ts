import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CompanyIndustryProfile,
  CompanyIndustrySyncCounts,
  CompanyIndustrySyncRepository,
  CompanyIndustrySyncTarget,
} from "@/domain/company-industry-sync";
import type { CompanyIndustryCategory } from "@/domain/company";
import { DataAccessError } from "@/domain/errors";

type RepositoryOptions = Readonly<{
  supabaseUrl: string;
  supabaseSecretKey: string;
}>;

export class SupabaseCompanyIndustrySyncRepository implements CompanyIndustrySyncRepository {
  constructor(private readonly client: SupabaseClient) {}

  async startRun(): Promise<string> {
    const { data, error } = await this.client
      .from("ingestion_runs")
      .insert({ job_type: "COMPANY_INDUSTRY_SYNC", status: "RUNNING" })
      .select("id")
      .single();
    if (error || !data) throw new DataAccessError("업종 동기화 실행 기록을 만들지 못했습니다.");
    return String(data.id);
  }

  async findPending(limit: number, afterId?: string): Promise<readonly CompanyIndustrySyncTarget[]> {
    let request = this.client
      .from("companies")
      .select("id,dart_corp_code")
      .eq("is_active", true)
      .eq("is_listed", true)
      .is("industry_profile_synced_at", null)
      .order("id")
      .limit(limit);
    if (afterId) request = request.gt("id", afterId);
    const { data, error } = await request;
    if (error) throw new DataAccessError("업종 동기화 대상을 조회하지 못했습니다.");
    return (data ?? []).map((row) => ({ id: String(row.id), dartCorpCode: String(row.dart_corp_code) }));
  }

  async saveProfile(
    target: CompanyIndustrySyncTarget,
    profile: CompanyIndustryProfile | null,
    category: CompanyIndustryCategory,
  ): Promise<void> {
    const now = new Date().toISOString();
    const values: Record<string, unknown> = {
      industry_code: profile?.industryCode ?? null,
      industry_category: category,
      industry_profile_attempted_at: now,
      industry_profile_synced_at: now,
      industry_profile_error_code: null,
    };
    if (profile) values.market = profile.market;
    const { error } = await this.client.from("companies").update(values).eq("id", target.id);
    if (error) throw new DataAccessError("기업 업종 정보를 저장하지 못했습니다.");
  }

  async recordFailure(target: CompanyIndustrySyncTarget, error: unknown): Promise<void> {
    const errorCode = error instanceof Error && "code" in error ? String(error.code) : "UNKNOWN";
    const { error: updateError } = await this.client
      .from("companies")
      .update({
        industry_profile_attempted_at: new Date().toISOString(),
        industry_profile_error_code: errorCode.slice(0, 100),
      })
      .eq("id", target.id);
    if (updateError) throw new DataAccessError("기업 업종 동기화 실패를 기록하지 못했습니다.");
  }

  async countPending(): Promise<number> {
    const { count, error } = await this.client
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_listed", true)
      .is("industry_profile_synced_at", null);
    if (error) throw new DataAccessError("남은 업종 동기화 대상을 계산하지 못했습니다.");
    return count ?? 0;
  }

  async finishRun(
    runId: string,
    counts: CompanyIndustrySyncCounts,
    stoppedReason?: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("ingestion_runs")
      .update({
        status: counts.remainingCount === 0 && counts.failedCount === 0 ? "SUCCEEDED" : "PARTIAL",
        finished_at: new Date().toISOString(),
        read_count: counts.attemptedCount,
        updated_count: counts.updatedCount,
        failed_count: counts.failedCount,
        error_code: stoppedReason?.slice(0, 100) ?? null,
        metadata: { remaining_count: counts.remainingCount, stopped_reason: stoppedReason ?? null },
      })
      .eq("id", runId);
    if (error) throw new DataAccessError("업종 동기화 실행 결과를 저장하지 못했습니다.");
  }
}

export function createSupabaseCompanyIndustrySyncRepository(
  options: RepositoryOptions,
): CompanyIndustrySyncRepository {
  const client = createClient(options.supabaseUrl, options.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return new SupabaseCompanyIndustrySyncRepository(client);
}

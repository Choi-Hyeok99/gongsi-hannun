import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HomeStatusRepository } from "@/domain/home-status";
import { DataAccessError } from "@/domain/errors";
import { readServerEnvironment } from "@/server/env";

type IngestionRunRow = Readonly<{ finished_at: string | null }>;

export class SupabaseHomeStatusRepository implements HomeStatusRepository {
  constructor(private readonly client: SupabaseClient) {}

  async countActiveListedCompanies(): Promise<number> {
    const { count, error } = await this.client
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_listed", true)
      .in("market", ["KOSPI", "KOSDAQ"]);
    if (error || count === null) throw new DataAccessError("상장기업 수를 집계하지 못했습니다.");
    return count;
  }

  async findLastSuccessfulDisclosureCollectionAt(): Promise<string | null> {
    const { data, error } = await this.client
      .from("ingestion_runs")
      .select("finished_at")
      .eq("job_type", "DISCLOSURE_COLLECT")
      .eq("status", "SUCCEEDED")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new DataAccessError("최근 공시 수집 시각을 조회하지 못했습니다.");
    return (data as IngestionRunRow | null)?.finished_at ?? null;
  }
}

export function createHomeStatusRepository(): HomeStatusRepository {
  const environment = readServerEnvironment();
  const client = createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return new SupabaseHomeStatusRepository(client);
}

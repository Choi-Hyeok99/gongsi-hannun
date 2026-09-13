import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DisclosureAlertCandidate } from "@/domain/disclosure-alert";
import { DataAccessError } from "@/domain/errors";

const BATCH_SIZE = 500;

type RepositoryOptions = Readonly<{
  supabaseUrl: string;
  supabaseSecretKey: string;
}>;

type DisclosureRow = Readonly<{
  id: string;
  company_id: string;
  report_name: string;
}>;

type CompanyRow = Readonly<{
  id: string;
  name_ko: string;
}>;

export class SupabaseDisclosureAlertCandidateReader {
  constructor(private readonly client: SupabaseClient) {}

  async listByDisclosedOn(disclosedOn: string): Promise<readonly DisclosureAlertCandidate[]> {
    const disclosures = await this.listDisclosures(disclosedOn);
    const companyNames = await this.loadCompanyNames(
      [...new Set(disclosures.map((disclosure) => disclosure.company_id))],
    );

    return disclosures.flatMap((disclosure) => {
      const companyName = companyNames.get(disclosure.company_id);
      if (!companyName) return [];
      return [{
        sourceDisclosureId: disclosure.id,
        companyId: disclosure.company_id,
        companyName,
        reportName: disclosure.report_name,
      }];
    });
  }

  private async listDisclosures(disclosedOn: string): Promise<readonly DisclosureRow[]> {
    const rows: DisclosureRow[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await this.client
        .from("source_disclosures")
        .select("id,company_id,report_name")
        .eq("disclosed_on", disclosedOn)
        .order("id", { ascending: true })
        .range(from, from + BATCH_SIZE - 1);
      if (error) throw new DataAccessError("알림 생성 대상 공시를 불러오지 못했습니다.");

      const batch = (data ?? []) as DisclosureRow[];
      rows.push(...batch);
      if (batch.length < BATCH_SIZE) break;
      from += BATCH_SIZE;
    }

    return rows;
  }

  private async loadCompanyNames(companyIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const names = new Map<string, string>();
    for (let offset = 0; offset < companyIds.length; offset += BATCH_SIZE) {
      const { data, error } = await this.client
        .from("companies")
        .select("id,name_ko")
        .in("id", companyIds.slice(offset, offset + BATCH_SIZE));
      if (error) throw new DataAccessError("알림 대상 기업을 불러오지 못했습니다.");
      for (const row of (data ?? []) as CompanyRow[]) names.set(row.id, row.name_ko);
    }
    return names;
  }
}

export function createSupabaseDisclosureAlertCandidateReader(
  options: RepositoryOptions,
): SupabaseDisclosureAlertCandidateReader {
  return new SupabaseDisclosureAlertCandidateReader(
    createClient(options.supabaseUrl, options.supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  );
}

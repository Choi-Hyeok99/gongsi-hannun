import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  DisclosureEventRepository,
  EventSourceDisclosure,
  MaterializedDisclosureEvent,
  SourceDisclosureStatus,
} from "@/domain/disclosure-event";
import { DataAccessError } from "@/domain/errors";

const EXISTING_BATCH_SIZE = 300;

type RepositoryOptions = Readonly<{
  supabaseUrl: string;
  supabaseSecretKey: string;
}>;

type SourceRow = Readonly<{
  id: string;
  company_id: string;
  report_name: string;
  disclosed_on: string;
  disclosure_status: SourceDisclosureStatus;
}>;

export class SupabaseDisclosureEventRepository implements DisclosureEventRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findSourceBatch(afterId: string | null, limit: number): Promise<readonly EventSourceDisclosure[]> {
    let request = this.client
      .from("source_disclosures")
      .select("id,company_id,report_name,disclosed_on,disclosure_status")
      .order("id", { ascending: true })
      .limit(limit);
    if (afterId) request = request.gt("id", afterId);
    const { data, error } = await request;
    if (error) throw new DataAccessError("이벤트 변환 대상 공시를 조회하지 못했습니다.");
    return ((data ?? []) as SourceRow[]).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      reportName: row.report_name,
      disclosedOn: row.disclosed_on,
      status: row.disclosure_status,
    }));
  }

  async upsertEvents(events: readonly MaterializedDisclosureEvent[]): Promise<Readonly<{ createdCount: number; updatedCount: number }>> {
    if (events.length === 0) return { createdCount: 0, updatedCount: 0 };
    const existing = await this.findExistingSourceIds(events.map((event) => event.sourceDisclosureId));
    const rows = events.map((event) => ({
      source_disclosure_id: event.sourceDisclosureId,
      company_id: event.companyId,
      event_type: event.eventType,
      title: event.title,
      occurred_on: event.occurredOn,
      occurred_on_basis: event.occurredOnBasis,
      facts: event.facts,
      rule_importance_score: event.ruleImportanceScore,
      importance_reasons: event.importanceReasons,
      importance_version: event.importanceVersion,
      visibility: event.visibility,
    }));
    const { error } = await this.client
      .from("events")
      .upsert(rows, { onConflict: "source_disclosure_id" });
    if (error) throw new DataAccessError("분류된 공시 이벤트를 저장하지 못했습니다.");
    const updatedCount = events.filter((event) => existing.has(event.sourceDisclosureId)).length;
    return { createdCount: events.length - updatedCount, updatedCount };
  }

  private async findExistingSourceIds(sourceIds: readonly string[]): Promise<Set<string>> {
    const existing = new Set<string>();
    for (let offset = 0; offset < sourceIds.length; offset += EXISTING_BATCH_SIZE) {
      const { data, error } = await this.client
        .from("events")
        .select("source_disclosure_id")
        .in("source_disclosure_id", sourceIds.slice(offset, offset + EXISTING_BATCH_SIZE));
      if (error) throw new DataAccessError("기존 공시 이벤트를 확인하지 못했습니다.");
      for (const row of data ?? []) existing.add(String(row.source_disclosure_id));
    }
    return existing;
  }
}

export function createSupabaseDisclosureEventRepository(
  options: RepositoryOptions,
): DisclosureEventRepository {
  return new SupabaseDisclosureEventRepository(
    createClient(options.supabaseUrl, options.supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  );
}

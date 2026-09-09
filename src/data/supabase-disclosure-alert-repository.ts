import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DisclosureEventType } from "@/domain/disclosure-classification";
import type {
  DisclosureAlertRepository,
  DisclosureAlertSetting,
  InAppDisclosureAlert,
} from "@/domain/disclosure-alert";
import { DataAccessError } from "@/domain/errors";

const BATCH_SIZE = 500;

type RepositoryOptions = Readonly<{
  supabaseUrl: string;
  supabaseSecretKey: string;
}>;

export class SupabaseDisclosureAlertRepository implements DisclosureAlertRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findEnabledSettings(companyIds: readonly string[]): Promise<readonly DisclosureAlertSetting[]> {
    if (companyIds.length === 0) return [];
    const settings: DisclosureAlertSetting[] = [];

    for (const batch of batches([...new Set(companyIds)], BATCH_SIZE)) {
      const { data, error } = await this.client
        .from("watchlist_alert_settings")
        .select("user_id,company_id,enabled,minimum_importance_score,event_types")
        .eq("enabled", true)
        .in("company_id", batch);
      if (error) throw new DataAccessError("중요 공시 알림 설정을 불러오지 못했습니다.");

      for (const row of data ?? []) {
        settings.push({
          userId: String(row.user_id),
          companyId: String(row.company_id),
          enabled: Boolean(row.enabled),
          minimumImportanceScore: Number(row.minimum_importance_score),
          eventTypes: (row.event_types ?? []) as DisclosureEventType[],
        });
      }
    }

    return settings;
  }

  async insertNotifications(alerts: readonly InAppDisclosureAlert[]): Promise<number> {
    let createdCount = 0;
    for (const batch of batches(alerts, BATCH_SIZE)) {
      const rows = batch.map((alert) => ({
        user_id: alert.userId,
        company_id: alert.companyId,
        source_disclosure_id: alert.sourceDisclosureId,
        event_type: alert.eventType,
        importance_score: alert.importanceScore,
        classification_version: alert.classificationVersion,
        title: alert.title,
        body: alert.body,
      }));
      const { data, error } = await this.client
        .from("in_app_notifications")
        .upsert(rows, {
          onConflict: "user_id,source_disclosure_id",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw new DataAccessError("중요 공시 알림을 저장하지 못했습니다.");
      createdCount += data?.length ?? 0;
    }
    return createdCount;
  }
}

export function createSupabaseDisclosureAlertRepository(
  options: RepositoryOptions,
): DisclosureAlertRepository {
  const client = createClient(options.supabaseUrl, options.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return new SupabaseDisclosureAlertRepository(client);
}

function batches<T>(values: readonly T[], size: number): readonly T[][] {
  const result: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    result.push(values.slice(offset, offset + size));
  }
  return result;
}

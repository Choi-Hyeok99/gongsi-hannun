import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DisclosureEventType } from "@/domain/disclosure-classification";
import { DataAccessError } from "@/domain/errors";
import {
  DEFAULT_ALERT_EVENT_TYPES,
  DEFAULT_ALERT_MINIMUM_SCORE,
  extractNotificationReason,
  type AlertPreference,
  type AlertPreferenceRepository,
  type NotificationCenterItem,
  type NotificationCenterRepository,
} from "@/domain/notification-center";
import { readServerEnvironment } from "@/server/env";

type PreferenceRow = Readonly<{
  company_id: string;
  enabled: boolean;
  minimum_importance_score: number;
  event_types: DisclosureEventType[] | null;
}>;

type NotificationRow = Readonly<{
  id: string;
  event_type: DisclosureEventType;
  importance_score: number;
  body: string;
  created_at: string;
  read_at: string | null;
  companies: { name_ko: string; stock_code: string } | { name_ko: string; stock_code: string }[];
  source_disclosures: {
    receipt_no: string;
    report_name: string;
    disclosed_on: string;
  } | {
    receipt_no: string;
    report_name: string;
    disclosed_on: string;
  }[];
}>;

function first<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0]! : value;
}

function mapNotification(row: NotificationRow): NotificationCenterItem {
  const company = first(row.companies);
  const disclosure = first(row.source_disclosures);
  return {
    id: row.id,
    companyName: company.name_ko,
    stockCode: company.stock_code,
    receiptNumber: disclosure.receipt_no,
    reportName: disclosure.report_name,
    eventType: row.event_type,
    importanceScore: row.importance_score,
    reason: extractNotificationReason(row.body, disclosure.report_name),
    disclosedOn: disclosure.disclosed_on,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export class SupabaseAlertPreferenceRepository implements AlertPreferenceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async ensureDefault(userId: string, companyId: string): Promise<void> {
    const { error } = await this.client.from("watchlist_alert_settings").upsert({
      user_id: userId,
      company_id: companyId,
      enabled: true,
      minimum_importance_score: DEFAULT_ALERT_MINIMUM_SCORE,
      event_types: DEFAULT_ALERT_EVENT_TYPES,
    }, { onConflict: "user_id,company_id", ignoreDuplicates: true });
    if (error) throw new DataAccessError("기본 알림 설정을 저장하지 못했습니다.");
  }

  async findByCompanyIds(userId: string, companyIds: readonly string[]): Promise<ReadonlyMap<string, AlertPreference>> {
    if (companyIds.length === 0) return new Map();
    const { data, error } = await this.client
      .from("watchlist_alert_settings")
      .select("company_id,enabled,minimum_importance_score,event_types")
      .eq("user_id", userId)
      .in("company_id", [...companyIds]);
    if (error) throw new DataAccessError("관심기업 알림 설정을 불러오지 못했습니다.");
    return new Map((data as PreferenceRow[]).map((row) => [row.company_id, {
      companyId: row.company_id,
      enabled: row.enabled,
      minimumImportanceScore: row.minimum_importance_score,
      eventTypes: row.event_types ?? [],
    }]));
  }

  async update(userId: string, preference: AlertPreference): Promise<void> {
    const { error } = await this.client
      .from("watchlist_alert_settings")
      .upsert({
        user_id: userId,
        company_id: preference.companyId,
        enabled: preference.enabled,
        minimum_importance_score: preference.minimumImportanceScore,
        event_types: preference.eventTypes,
      }, { onConflict: "user_id,company_id" });
    if (error) throw new DataAccessError("알림 설정을 변경하지 못했습니다.");
  }
}

export class SupabaseNotificationCenterRepository implements NotificationCenterRepository {
  constructor(private readonly client: SupabaseClient) {}

  async countUnread(userId: string): Promise<number> {
    const { count, error } = await this.client
      .from("in_app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw new DataAccessError("읽지 않은 알림 수를 불러오지 못했습니다.");
    return count ?? 0;
  }

  async list(userId: string): Promise<readonly NotificationCenterItem[]> {
    const { data, error } = await this.client
      .from("in_app_notifications")
      .select("id,event_type,importance_score,body,created_at,read_at,companies!inner(name_ko,stock_code),source_disclosures!inner(receipt_no,report_name,disclosed_on)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new DataAccessError("알림을 불러오지 못했습니다.");
    return (data as unknown as NotificationRow[])
      .map(mapNotification)
      .sort((left, right) => Number(left.readAt !== null) - Number(right.readAt !== null));
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationCenterItem | null> {
    const { data, error } = await this.client
      .from("in_app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .select("id,event_type,importance_score,body,created_at,read_at,companies!inner(name_ko,stock_code),source_disclosures!inner(receipt_no,report_name,disclosed_on)")
      .maybeSingle();
    if (error) throw new DataAccessError("알림 읽음 상태를 변경하지 못했습니다.");
    return data ? mapNotification(data as unknown as NotificationRow) : null;
  }

  async markAllRead(userId: string): Promise<void> {
    const { error } = await this.client
      .from("in_app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw new DataAccessError("모든 알림을 읽음 처리하지 못했습니다.");
  }
}

export function createNotificationCenterRepository(): NotificationCenterRepository {
  const environment = readServerEnvironment();
  return new SupabaseNotificationCenterRepository(createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

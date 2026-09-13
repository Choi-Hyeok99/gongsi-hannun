import {
  DISCLOSURE_EVENT_TYPES,
  isDisclosureEventType,
  type DisclosureEventType,
} from "@/domain/disclosure-classification";

export const DEFAULT_ALERT_MINIMUM_SCORE = 70;
export const STRICT_ALERT_MINIMUM_SCORE = 85;
export const DEFAULT_ALERT_EVENT_TYPES = DISCLOSURE_EVENT_TYPES.filter((eventType) => eventType !== "OTHER");

export type AlertPreference = Readonly<{
  companyId: string;
  enabled: boolean;
  minimumImportanceScore: number;
  eventTypes: readonly DisclosureEventType[];
}>;

export type NotificationCenterItem = Readonly<{
  id: string;
  companyName: string;
  stockCode: string;
  receiptNumber: string;
  reportName: string;
  eventType: DisclosureEventType;
  importanceScore: number;
  reason: string;
  disclosedOn: string;
  createdAt: string;
  readAt: string | null;
}>;

export interface AlertPreferenceRepository {
  ensureDefault(userId: string, companyId: string): Promise<void>;
  findByCompanyIds(userId: string, companyIds: readonly string[]): Promise<ReadonlyMap<string, AlertPreference>>;
  update(userId: string, preference: AlertPreference): Promise<void>;
}

export interface NotificationCenterRepository {
  countUnread(userId: string): Promise<number>;
  list(userId: string): Promise<readonly NotificationCenterItem[]>;
  markRead(userId: string, notificationId: string): Promise<NotificationCenterItem | null>;
  markAllRead(userId: string): Promise<void>;
}

export function parseAlertPreference(formData: FormData): AlertPreference | null {
  const companyId = formData.get("companyId");
  const enabled = formData.get("enabled") === "true";
  const minimumImportanceScore = Number(formData.get("minimumImportanceScore"));
  const rawEventTypes = formData.getAll("eventTypes");

  if (typeof companyId !== "string" || !/^[0-9a-f-]{36}$/i.test(companyId)) return null;
  if (![DEFAULT_ALERT_MINIMUM_SCORE, STRICT_ALERT_MINIMUM_SCORE].includes(minimumImportanceScore)) return null;
  if (!rawEventTypes.every((value) => typeof value === "string" && isDisclosureEventType(value))) return null;

  return {
    companyId,
    enabled,
    minimumImportanceScore,
    eventTypes: rawEventTypes as DisclosureEventType[],
  };
}

export function extractNotificationReason(body: string, reportName: string): string {
  const prefix = `${reportName} · `;
  return body.startsWith(prefix) ? body.slice(prefix.length) : body;
}

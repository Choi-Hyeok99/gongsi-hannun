import {
  classifyDisclosureReport,
  type DisclosureEventType,
} from "@/domain/disclosure-classification";

export type DisclosureAlertCandidate = Readonly<{
  sourceDisclosureId: string;
  companyId: string;
  companyName: string;
  reportName: string;
}>;

export type DisclosureAlertSetting = Readonly<{
  userId: string;
  companyId: string;
  enabled: boolean;
  minimumImportanceScore: number;
  eventTypes: readonly DisclosureEventType[];
}>;

export type InAppDisclosureAlert = Readonly<{
  userId: string;
  companyId: string;
  sourceDisclosureId: string;
  eventType: DisclosureEventType;
  importanceScore: number;
  classificationVersion: string;
  title: string;
  body: string;
}>;

export interface DisclosureAlertRepository {
  findEnabledSettings(companyIds: readonly string[]): Promise<readonly DisclosureAlertSetting[]>;
  insertNotifications(alerts: readonly InAppDisclosureAlert[]): Promise<number>;
}

export function createInAppDisclosureAlert(
  candidate: DisclosureAlertCandidate,
  setting: DisclosureAlertSetting,
): InAppDisclosureAlert | null {
  if (!setting.enabled || setting.companyId !== candidate.companyId) return null;

  const classification = classifyDisclosureReport(candidate.reportName);
  if (classification.ruleImportanceScore < setting.minimumImportanceScore) return null;
  if (setting.eventTypes.length > 0 && !setting.eventTypes.includes(classification.eventType)) return null;

  return {
    userId: setting.userId,
    companyId: candidate.companyId,
    sourceDisclosureId: candidate.sourceDisclosureId,
    eventType: classification.eventType,
    importanceScore: classification.ruleImportanceScore,
    classificationVersion: classification.importanceVersion,
    title: `${candidate.companyName} 중요 공시`,
    body: `${candidate.reportName} · ${classification.importanceReasons[0]}`,
  };
}

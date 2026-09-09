import type {
  DisclosureAlertCandidate,
  DisclosureAlertRepository,
  DisclosureAlertSetting,
  InAppDisclosureAlert,
} from "@/domain/disclosure-alert";
import { createInAppDisclosureAlert } from "@/domain/disclosure-alert";

type Dependencies = Readonly<{
  repository: DisclosureAlertRepository;
}>;

export async function generateImportantDisclosureAlerts(
  dependencies: Dependencies,
  candidates: readonly DisclosureAlertCandidate[],
): Promise<Readonly<{ candidateCount: number; eligibleCount: number; createdCount: number }>> {
  if (candidates.length === 0) {
    return { candidateCount: 0, eligibleCount: 0, createdCount: 0 };
  }

  const uniqueCandidates = deduplicateCandidates(candidates);
  const companyIds = [...new Set(uniqueCandidates.map((candidate) => candidate.companyId))];
  const settings = await dependencies.repository.findEnabledSettings(companyIds);
  const settingsByCompany = groupSettingsByCompany(settings);
  const alerts = new Map<string, InAppDisclosureAlert>();

  for (const candidate of uniqueCandidates) {
    for (const setting of settingsByCompany.get(candidate.companyId) ?? []) {
      const alert = createInAppDisclosureAlert(candidate, setting);
      if (alert) alerts.set(`${alert.userId}:${alert.sourceDisclosureId}`, alert);
    }
  }

  const notifications = [...alerts.values()];
  const createdCount = await dependencies.repository.insertNotifications(notifications);
  return {
    candidateCount: uniqueCandidates.length,
    eligibleCount: notifications.length,
    createdCount,
  };
}

function deduplicateCandidates(
  candidates: readonly DisclosureAlertCandidate[],
): readonly DisclosureAlertCandidate[] {
  const unique = new Map<string, DisclosureAlertCandidate>();
  for (const candidate of candidates) {
    validateCandidate(candidate);
    unique.set(candidate.sourceDisclosureId, candidate);
  }
  return [...unique.values()];
}

function validateCandidate(candidate: DisclosureAlertCandidate): void {
  if (!candidate.sourceDisclosureId || !candidate.companyId) {
    throw new Error("알림 생성에 필요한 공시와 기업 식별자가 없습니다.");
  }
  if (!candidate.companyName.trim() || !candidate.reportName.trim()) {
    throw new Error("알림 생성에 필요한 기업명과 공시명이 없습니다.");
  }
}

function groupSettingsByCompany(
  settings: readonly DisclosureAlertSetting[],
): ReadonlyMap<string, readonly DisclosureAlertSetting[]> {
  const grouped = new Map<string, DisclosureAlertSetting[]>();
  for (const setting of settings) {
    if (!setting.enabled) continue;
    const values = grouped.get(setting.companyId) ?? [];
    values.push(setting);
    grouped.set(setting.companyId, values);
  }
  return grouped;
}

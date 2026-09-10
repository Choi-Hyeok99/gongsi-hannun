import { describe, expect, it, vi } from "vitest";
import type { DisclosureAlertRepository, DisclosureAlertSetting } from "@/domain/disclosure-alert";
import { createInAppDisclosureAlert } from "@/domain/disclosure-alert";
import { generateImportantDisclosureAlerts } from "@/server/disclosure-alert-use-cases";

const candidate = {
  sourceDisclosureId: "disclosure-1",
  companyId: "company-1",
  companyName: "한눈전자",
  reportName: "단일판매ㆍ공급계약체결",
} as const;

const setting: DisclosureAlertSetting = {
  userId: "user-1",
  companyId: "company-1",
  enabled: true,
  minimumImportanceScore: 70,
  eventTypes: [],
};

function createRepository(settings: readonly DisclosureAlertSetting[] = [setting]): DisclosureAlertRepository {
  return {
    findEnabledSettings: vi.fn(async () => settings),
    insertNotifications: vi.fn(async (alerts) => alerts.length),
  };
}

describe("important disclosure alerts", () => {
  it("reuses disclosure classification to create a deterministic alert", () => {
    expect(createInAppDisclosureAlert(candidate, setting)).toMatchObject({
      eventType: "SUPPLY_CONTRACT",
      importanceScore: 75,
      classificationVersion: "report-name-v1",
      title: "한눈전자 중요 공시",
    });
  });

  it("respects the importance threshold and selected event types", () => {
    expect(createInAppDisclosureAlert(candidate, { ...setting, minimumImportanceScore: 80 })).toBeNull();
    expect(createInAppDisclosureAlert(candidate, { ...setting, eventTypes: ["EARNINGS"] })).toBeNull();
  });

  it("creates one idempotency key per user and disclosure", async () => {
    const repository = createRepository();

    await expect(generateImportantDisclosureAlerts({ repository }, [candidate, candidate])).resolves.toEqual({
      candidateCount: 1,
      eligibleCount: 1,
      createdCount: 1,
    });
    expect(repository.insertNotifications).toHaveBeenCalledWith([
      expect.objectContaining({ userId: "user-1", sourceDisclosureId: "disclosure-1" }),
    ]);
  });

  it("creates alerts only for eligible interested users", async () => {
    const repository = createRepository([
      setting,
      { ...setting, userId: "user-2", minimumImportanceScore: 90 },
      { ...setting, userId: "user-3", eventTypes: ["SUPPLY_CONTRACT"] },
    ]);

    await expect(generateImportantDisclosureAlerts({ repository }, [candidate])).resolves.toEqual({
      candidateCount: 1,
      eligibleCount: 2,
      createdCount: 2,
    });
  });

  it("does not query storage when there are no candidates", async () => {
    const repository = createRepository();

    await expect(generateImportantDisclosureAlerts({ repository }, [])).resolves.toEqual({
      candidateCount: 0,
      eligibleCount: 0,
      createdCount: 0,
    });
    expect(repository.findEnabledSettings).not.toHaveBeenCalled();
    expect(repository.insertNotifications).not.toHaveBeenCalled();
  });
});

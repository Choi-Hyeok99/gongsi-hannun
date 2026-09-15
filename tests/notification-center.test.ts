import { describe, expect, it, vi } from "vitest";
import {
  extractNotificationReason,
  filterNotifications,
  parseAlertPreference,
  parseNotificationView,
  type AlertPreferenceRepository,
  type NotificationCenterRepository,
} from "@/domain/notification-center";
import {
  ensureDefaultAlertPreference,
  readAllNotifications,
  readNotification,
  updateAlertPreference,
} from "@/server/notification-center-use-cases";

function createPreferenceRepository(): AlertPreferenceRepository {
  return {
    ensureDefault: vi.fn().mockResolvedValue(undefined),
    findByCompanyIds: vi.fn().mockResolvedValue(new Map()),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

function createNotificationRepository(): NotificationCenterRepository {
  return {
    countUnread: vi.fn().mockResolvedValue(1),
    list: vi.fn().mockResolvedValue([]),
    markRead: vi.fn().mockResolvedValue(null),
    markAllRead: vi.fn().mockResolvedValue(undefined),
  };
}

describe("alert preference input", () => {
  it("accepts the supported score preset and selected event types", () => {
    const formData = new FormData();
    formData.set("companyId", "123e4567-e89b-12d3-a456-426614174000");
    formData.set("enabled", "true");
    formData.set("minimumImportanceScore", "85");
    formData.append("eventTypes", "M_AND_A");
    formData.append("eventTypes", "EARNINGS");

    expect(parseAlertPreference(formData)).toEqual({
      companyId: "123e4567-e89b-12d3-a456-426614174000",
      enabled: true,
      minimumImportanceScore: 85,
      eventTypes: ["M_AND_A", "EARNINGS"],
    });
  });

  it("accepts the broad 60 point preset", () => {
    const formData = new FormData();
    formData.set("companyId", "123e4567-e89b-12d3-a456-426614174000");
    formData.set("minimumImportanceScore", "60");
    expect(parseAlertPreference(formData)?.minimumImportanceScore).toBe(60);
  });

  it("rejects an unsupported score or event type", () => {
    const formData = new FormData();
    formData.set("companyId", "123e4567-e89b-12d3-a456-426614174000");
    formData.set("minimumImportanceScore", "10");
    formData.set("eventTypes", "NOT_A_TYPE");
    expect(parseAlertPreference(formData)).toBeNull();
  });

  it("treats no selected type as all types above the score threshold", () => {
    const formData = new FormData();
    formData.set("companyId", "123e4567-e89b-12d3-a456-426614174000");
    formData.set("minimumImportanceScore", "70");
    expect(parseAlertPreference(formData)?.eventTypes).toEqual([]);
  });

  it("separates the report title from its classification reason", () => {
    expect(extractNotificationReason("합병결정 · 기업 구조 변화입니다.", "합병결정"))
      .toBe("기업 구조 변화입니다.");
  });
});

describe("notification history filters", () => {
  const items = [
    { id: "1", companyName: "한눈전자", stockCode: "000001", receiptNumber: "1", reportName: "공시", eventType: "EARNINGS" as const, importanceScore: 70, reason: "실적", disclosedOn: "2026-09-15", createdAt: "2026-09-15T00:00:00Z", readAt: null },
    { id: "2", companyName: "한눈바이오", stockCode: "000002", receiptNumber: "2", reportName: "공시", eventType: "CLINICAL_RESULT" as const, importanceScore: 85, reason: "임상", disclosedOn: "2026-09-15", createdAt: "2026-09-15T01:00:00Z", readAt: "2026-09-15T02:00:00Z" },
  ];

  it("normalizes unknown views and filters unread or critical items", () => {
    expect(parseNotificationView("unknown")).toBe("all");
    expect(filterNotifications(items, "unread").map((item) => item.id)).toEqual(["1"]);
    expect(filterNotifications(items, "critical").map((item) => item.id)).toEqual(["2"]);
  });
});

describe("notification center use cases", () => {
  it("creates default preferences for a newly saved company", async () => {
    const repository = createPreferenceRepository();
    await ensureDefaultAlertPreference(repository, "user-1", "company-1");
    expect(repository.ensureDefault).toHaveBeenCalledWith("user-1", "company-1");
  });

  it("updates only the authenticated user's preference", async () => {
    const repository = createPreferenceRepository();
    const preference = {
      companyId: "company-1",
      enabled: false,
      minimumImportanceScore: 85,
      eventTypes: ["M_AND_A"] as const,
    };
    await updateAlertPreference(repository, "user-1", preference);
    expect(repository.update).toHaveBeenCalledWith("user-1", preference);
  });

  it("scopes individual and bulk read operations to the owner", async () => {
    const repository = createNotificationRepository();
    await readNotification(repository, "user-1", "notification-1");
    await readAllNotifications(repository, "user-1");
    expect(repository.markRead).toHaveBeenCalledWith("user-1", "notification-1");
    expect(repository.markAllRead).toHaveBeenCalledWith("user-1");
  });
});

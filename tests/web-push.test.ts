import { describe, expect, it, vi } from "vitest";
import type {
  WebPushDeliveryRepository,
  WebPushDeliveryTarget,
  WebPushSender,
} from "@/domain/web-push";
import { buildWebPushPayload, isPermanentWebPushFailure } from "@/domain/web-push";
import { deliverPendingWebPushes } from "@/server/web-push-use-cases";

const target: WebPushDeliveryTarget = {
  notificationId: "notification-1",
  subscriptionId: "subscription-1",
  endpoint: "https://push.example/subscription-1",
  p256dh: "public-key",
  auth: "auth-secret",
  title: "삼성전자 새 중요 공시",
  body: "공급계약 공시가 등록됐습니다.",
  targetPath: "/disclosures/202609150001",
  attemptCount: 0,
};

function repository(values: readonly WebPushDeliveryTarget[] = [target]): WebPushDeliveryRepository {
  return {
    listPending: vi.fn().mockResolvedValue(values),
    markSent: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  };
}

describe("web push delivery", () => {
  it("builds a disclosure deep-link payload with a stable notification tag", () => {
    expect(JSON.parse(buildWebPushPayload(target))).toEqual({
      title: target.title,
      body: target.body,
      url: target.targetPath,
      tag: "disclosure-notification-1",
    });
  });

  it("marks a successful delivery as sent", async () => {
    const store = repository();
    const sender: WebPushSender = { send: vi.fn().mockResolvedValue(undefined) };
    await expect(deliverPendingWebPushes({ repository: store, sender })).resolves.toEqual({
      attempted: 1,
      sent: 1,
      failed: 0,
      disabled: 0,
    });
    expect(store.markSent).toHaveBeenCalledWith(target);
  });

  it("disables a subscription rejected as gone by the push service", async () => {
    const store = repository();
    const error = Object.assign(new Error("Gone"), { statusCode: 410 });
    const sender: WebPushSender = { send: vi.fn().mockRejectedValue(error) };
    await expect(deliverPendingWebPushes({ repository: store, sender })).resolves.toEqual({
      attempted: 1,
      sent: 0,
      failed: 1,
      disabled: 1,
    });
    expect(store.markFailed).toHaveBeenCalledWith(target, "Gone", true);
  });

  it("keeps transient failures retryable", () => {
    expect(isPermanentWebPushFailure(Object.assign(new Error("Gone"), { statusCode: 404 }))).toBe(true);
    expect(isPermanentWebPushFailure(Object.assign(new Error("Busy"), { statusCode: 503 }))).toBe(false);
  });
});

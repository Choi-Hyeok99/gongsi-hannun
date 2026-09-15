export type WebPushDeliveryTarget = Readonly<{
  notificationId: string;
  subscriptionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  targetPath: string;
  attemptCount: number;
}>;

export interface WebPushDeliveryRepository {
  listPending(limit: number): Promise<readonly WebPushDeliveryTarget[]>;
  markSent(target: WebPushDeliveryTarget): Promise<void>;
  markFailed(target: WebPushDeliveryTarget, message: string, permanent: boolean): Promise<void>;
}

export interface WebPushSender {
  send(target: WebPushDeliveryTarget): Promise<void>;
}

export function buildWebPushPayload(target: WebPushDeliveryTarget): string {
  return JSON.stringify({
    title: target.title,
    body: target.body,
    url: target.targetPath,
    tag: `disclosure-${target.notificationId}`,
  });
}

export function isPermanentWebPushFailure(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return false;
  return error.statusCode === 404 || error.statusCode === 410;
}

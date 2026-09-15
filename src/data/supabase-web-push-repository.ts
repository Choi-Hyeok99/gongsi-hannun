import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DataAccessError } from "@/domain/errors";
import type { WebPushDeliveryRepository, WebPushDeliveryTarget } from "@/domain/web-push";

type RepositoryOptions = Readonly<{ supabaseUrl: string; supabaseSecretKey: string }>;

type NotificationRow = Readonly<{
  id: string;
  user_id: string;
  title: string;
  body: string;
  importance_score: number;
  created_at: string;
  source_disclosures: { receipt_no: string } | { receipt_no: string }[];
}>;

type SubscriptionRow = Readonly<{
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  minimum_importance_score: number;
}>;

type DeliveryRow = Readonly<{
  notification_id: string;
  subscription_id: string;
  status: "PENDING" | "SENT" | "FAILED";
  attempt_count: number;
}>;

function first<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0]! : value;
}

export class SupabaseWebPushDeliveryRepository implements WebPushDeliveryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listPending(limit: number): Promise<readonly WebPushDeliveryTarget[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 500);
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: notificationData, error: notificationError } = await this.client
      .from("in_app_notifications")
      .select("id,user_id,title,body,importance_score,created_at,source_disclosures!inner(receipt_no)")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(500);
    if (notificationError) throw new DataAccessError("푸시 대상 알림을 불러오지 못했습니다.");

    const notifications = (notificationData ?? []) as unknown as NotificationRow[];
    const userIds = [...new Set(notifications.map((item) => item.user_id))];
    if (userIds.length === 0) return [];

    const { data: subscriptionData, error: subscriptionError } = await this.client
      .from("web_push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth,created_at,minimum_importance_score")
      .in("user_id", userIds)
      .is("disabled_at", null);
    if (subscriptionError) throw new DataAccessError("활성 푸시 구독을 불러오지 못했습니다.");

    const subscriptions = (subscriptionData ?? []) as SubscriptionRow[];
    if (subscriptions.length === 0) return [];

    const notificationIds = notifications.map((item) => item.id);
    const subscriptionIds = subscriptions.map((item) => item.id);
    const { data: deliveryData, error: deliveryError } = await this.client
      .from("web_push_deliveries")
      .select("notification_id,subscription_id,status,attempt_count")
      .in("notification_id", notificationIds)
      .in("subscription_id", subscriptionIds);
    if (deliveryError) throw new DataAccessError("푸시 전송 기록을 불러오지 못했습니다.");

    const deliveryMap = new Map((deliveryData as DeliveryRow[] | null ?? []).map((row) => [
      `${row.notification_id}:${row.subscription_id}`,
      row,
    ]));
    const subscriptionsByUser = new Map<string, SubscriptionRow[]>();
    for (const subscription of subscriptions) {
      const values = subscriptionsByUser.get(subscription.user_id) ?? [];
      values.push(subscription);
      subscriptionsByUser.set(subscription.user_id, values);
    }

    const targets: WebPushDeliveryTarget[] = [];
    for (const notification of notifications) {
      for (const subscription of subscriptionsByUser.get(notification.user_id) ?? []) {
        if (notification.created_at < subscription.created_at) continue;
        if (notification.importance_score < subscription.minimum_importance_score) continue;
        const previous = deliveryMap.get(`${notification.id}:${subscription.id}`);
        if (previous?.status === "SENT" || (previous?.attempt_count ?? 0) >= 3) continue;
        targets.push({
          notificationId: notification.id,
          subscriptionId: subscription.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          title: notification.title,
          body: notification.body,
          targetPath: `/disclosures/${first(notification.source_disclosures).receipt_no}`,
          attemptCount: previous?.attempt_count ?? 0,
        });
        if (targets.length >= boundedLimit) return targets;
      }
    }
    return targets;
  }

  async markSent(target: WebPushDeliveryTarget): Promise<void> {
    const now = new Date().toISOString();
    const { error: deliveryError } = await this.client.from("web_push_deliveries").upsert({
      notification_id: target.notificationId,
      subscription_id: target.subscriptionId,
      status: "SENT",
      attempt_count: target.attemptCount + 1,
      last_error: null,
      sent_at: now,
    }, { onConflict: "notification_id,subscription_id" });
    if (deliveryError) throw new DataAccessError("푸시 성공 기록을 저장하지 못했습니다.");

    const { error: subscriptionError } = await this.client.from("web_push_subscriptions")
      .update({ last_success_at: now, failure_count: 0 })
      .eq("id", target.subscriptionId);
    if (subscriptionError) throw new DataAccessError("푸시 구독 성공 상태를 저장하지 못했습니다.");
  }

  async markFailed(target: WebPushDeliveryTarget, message: string, permanent: boolean): Promise<void> {
    const now = new Date().toISOString();
    const { error: deliveryError } = await this.client.from("web_push_deliveries").upsert({
      notification_id: target.notificationId,
      subscription_id: target.subscriptionId,
      status: "FAILED",
      attempt_count: target.attemptCount + 1,
      last_error: message.slice(0, 1000),
    }, { onConflict: "notification_id,subscription_id" });
    if (deliveryError) throw new DataAccessError("푸시 실패 기록을 저장하지 못했습니다.");

    if (permanent) {
      const { error } = await this.client.from("web_push_subscriptions")
        .update({ disabled_at: now })
        .eq("id", target.subscriptionId);
      if (error) throw new DataAccessError("만료된 푸시 구독을 비활성화하지 못했습니다.");
    }
  }
}

export function createSupabaseWebPushDeliveryRepository(options: RepositoryOptions): WebPushDeliveryRepository {
  return new SupabaseWebPushDeliveryRepository(createClient(options.supabaseUrl, options.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }));
}

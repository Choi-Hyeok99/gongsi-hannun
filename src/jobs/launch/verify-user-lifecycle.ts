import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const CONFIRMATION = "I_UNDERSTAND_TEST_USER_WILL_BE_DELETED";

async function main() {
  if (process.env.RUN_DESTRUCTIVE_ACCOUNT_TEST !== CONFIRMATION) {
    throw new Error(`RUN_DESTRUCTIVE_ACCOUNT_TEST must equal ${CONFIRMATION}`);
  }

  const supabaseUrl = required("SUPABASE_URL");
  const secretKey = required("SUPABASE_SECRET_KEY");
  const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const publicClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const insertOrThrow = async (table: string, row: Record<string, unknown>) => {
    const { error } = await admin.from(table).insert(row);
    if (error) throw error;
  };
  const countRows = async (table: string, field: string, value: string): Promise<number> => {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq(field, value);
    if (error) throw error;
    return count ?? 0;
  };
  const email = `codex-lifecycle-${Date.now()}@example.invalid`;
  const password = `${randomBytes(18).toString("base64url")}aA1!`;
  let userId: string | null = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        terms_accepted_version: "2026-09-26",
        privacy_accepted_version: "2026-09-26",
      },
    });
    if (createError || !created.user) throw createError ?? new Error("Test user was not created");
    userId = created.user.id;

    const { data: signedIn, error: signInError } = await publicClient.auth.signInWithPassword({ email, password });
    if (signInError || signedIn.user?.id !== userId) throw signInError ?? new Error("Email login did not return the test user");
    await publicClient.auth.signOut();

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("company_id,source_disclosure_id,event_type,rule_importance_score")
      .eq("visibility", "PUBLIC")
      .not("source_disclosure_id", "is", null)
      .order("occurred_on", { ascending: false })
      .limit(1)
      .single();
    if (eventError || !event) throw eventError ?? new Error("No public disclosure event is available for verification");

    await insertOrThrow("watchlist_companies", { user_id: userId, company_id: event.company_id });
    const duplicate = await admin.from("watchlist_companies").insert({ user_id: userId, company_id: event.company_id });
    if (duplicate.error?.code !== "23505") throw new Error("Duplicate watchlist insertion was not rejected");
    await insertOrThrow("watchlist_alert_settings", {
      user_id: userId,
      company_id: event.company_id,
      enabled: true,
      minimum_importance_score: 60,
      event_types: [event.event_type],
    });

    const { data: notification, error: notificationError } = await admin.from("in_app_notifications").insert({
      user_id: userId,
      company_id: event.company_id,
      source_disclosure_id: event.source_disclosure_id,
      event_type: event.event_type,
      importance_score: Math.max(0, Math.min(100, Number(event.rule_importance_score))),
      classification_version: "launch-readiness-test",
      title: "출시 준비 테스트 알림",
      body: "테스트 계정 삭제와 알림 소유권 검증용 데이터입니다.",
    }).select("id").single();
    if (notificationError || !notification) throw notificationError ?? new Error("Test notification was not created");

    const { data: subscription, error: subscriptionError } = await admin.from("web_push_subscriptions").insert({
      user_id: userId,
      endpoint: `https://push.invalid/${randomUUID()}`,
      p256dh: randomBytes(32).toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
      user_agent: "gongsi-hannun-launch-readiness-test",
    }).select("id").single();
    if (subscriptionError || !subscription) throw subscriptionError ?? new Error("Test push subscription was not created");
    await insertOrThrow("web_push_deliveries", {
      notification_id: notification.id,
      subscription_id: subscription.id,
    });

    const readAt = new Date(Date.now() + 1_000).toISOString();
    const { data: markedRead, error: readError } = await admin.from("in_app_notifications")
      .update({ read_at: readAt })
      .eq("id", notification.id)
      .eq("user_id", userId)
      .select("id,read_at")
      .single();
    if (readError || !markedRead?.read_at) throw readError ?? new Error("Notification read state was not stored");

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    const residualCounts = await Promise.all([
      countRows("profiles", "user_id", userId),
      countRows("watchlist_companies", "user_id", userId),
      countRows("watchlist_alert_settings", "user_id", userId),
      countRows("in_app_notifications", "user_id", userId),
      countRows("web_push_subscriptions", "user_id", userId),
      countRows("user_consents", "user_id", userId),
      countRows("web_push_deliveries", "notification_id", notification.id),
    ]);
    if (residualCounts.some((count) => count !== 0)) throw new Error(`Account deletion left residual rows: ${residualCounts.join(",")}`);
    userId = null;

    console.log("사용자 생명주기 검증 완료: 이메일 로그인, 관심기업 중복 방지, 알림 읽음 처리, 계정 연쇄 삭제");
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "사용자 생명주기 검증 실패");
  process.exitCode = 1;
});

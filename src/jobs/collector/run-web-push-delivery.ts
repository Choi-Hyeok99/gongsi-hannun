import webPush from "web-push";
import { z } from "zod";
import { createSupabaseWebPushDeliveryRepository } from "@/data/supabase-web-push-repository";
import { buildWebPushPayload, type WebPushSender } from "@/domain/web-push";
import { deliverPendingWebPushes } from "@/server/web-push-use-cases";

const environmentSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().min(20),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().min(20),
  WEB_PUSH_VAPID_SUBJECT: z.string().startsWith("mailto:"),
});

async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  webPush.setVapidDetails(
    environment.WEB_PUSH_VAPID_SUBJECT,
    environment.WEB_PUSH_VAPID_PUBLIC_KEY,
    environment.WEB_PUSH_VAPID_PRIVATE_KEY,
  );

  const sender: WebPushSender = {
    async send(target) {
      await webPush.sendNotification({
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      }, buildWebPushPayload(target), { TTL: 60 * 60, urgency: "normal" });
    },
  };
  const result = await deliverPendingWebPushes({
    repository: createSupabaseWebPushDeliveryRepository({
      supabaseUrl: environment.SUPABASE_URL,
      supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
    }),
    sender,
  });
  console.info(`웹 푸시 전송 완료: 시도 ${result.attempted}, 성공 ${result.sent}, 실패 ${result.failed}, 만료 해제 ${result.disabled}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "웹 푸시 전송에 실패했습니다.");
  process.exitCode = 1;
});

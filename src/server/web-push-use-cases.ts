import type {
  WebPushDeliveryRepository,
  WebPushSender,
} from "@/domain/web-push";
import { isPermanentWebPushFailure } from "@/domain/web-push";

type Dependencies = Readonly<{
  repository: WebPushDeliveryRepository;
  sender: WebPushSender;
}>;

export async function deliverPendingWebPushes(
  dependencies: Dependencies,
  limit = 100,
): Promise<Readonly<{ attempted: number; sent: number; failed: number; disabled: number }>> {
  const targets = await dependencies.repository.listPending(limit);
  let sent = 0;
  let failed = 0;
  let disabled = 0;

  for (const target of targets) {
    try {
      await dependencies.sender.send(target);
      await dependencies.repository.markSent(target);
      sent += 1;
    } catch (error) {
      const permanent = isPermanentWebPushFailure(error);
      const message = error instanceof Error ? error.message : "Unknown web push delivery error";
      await dependencies.repository.markFailed(target, message, permanent);
      failed += 1;
      if (permanent) disabled += 1;
    }
  }

  return { attempted: targets.length, sent, failed, disabled };
}

import type {
  DisclosureDocumentSource,
  DisclosureDocumentSyncCounts,
  DisclosureDocumentSyncRepository,
} from "@/domain/disclosure-document";

type Dependencies = Readonly<{
  source: DisclosureDocumentSource;
  repository: DisclosureDocumentSyncRepository;
  concurrency?: number;
}>;

export async function syncDisclosureDocuments(
  dependencies: Dependencies,
  limit: number,
): Promise<DisclosureDocumentSyncCounts> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new RangeError("원문 수집 개수는 1~200이어야 합니다.");
  const pending = await dependencies.repository.listPending(limit);
  let documentCount = 0;
  let failedCount = 0;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < pending.length) {
      const item = pending[cursor];
      cursor += 1;
      if (!item) return;
      try {
        await dependencies.repository.markFetching(item.id);
        const documents = await dependencies.source.fetchDocuments(item.receiptNumber);
        await dependencies.repository.saveDocuments(item.id, documents);
        documentCount += documents.length;
      } catch (error) {
        failedCount += 1;
        await dependencies.repository.markFailed(item.id, error);
      }
    }
  }

  const concurrency = Math.min(Math.max(dependencies.concurrency ?? 3, 1), 5, pending.length || 1);
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { disclosureCount: pending.length, documentCount, failedCount };
}

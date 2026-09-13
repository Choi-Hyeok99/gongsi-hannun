import { describe, expect, it, vi } from "vitest";
import type { ExtractedDisclosureDocument } from "@/domain/disclosure-document";
import { syncDisclosureDocuments } from "@/jobs/collector/sync-disclosure-documents";

const document: ExtractedDisclosureDocument = {
  sequenceNumber: 1,
  kind: "MAIN",
  title: "사업보고서",
  fileName: "document.xml",
  mimeType: "application/xml",
  byteSize: 100,
  contentHash: "a".repeat(64),
  contentText: "문서 내용",
  isTruncated: false,
};

describe("syncDisclosureDocuments", () => {
  it("continues other filings when one source document fails", async () => {
    const repository = {
      listPending: vi.fn(async () => [
        { id: "source-1", receiptNumber: "20260909000001" },
        { id: "source-2", receiptNumber: "20260909000002" },
      ]),
      markFetching: vi.fn(async () => undefined),
      saveDocuments: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const source = {
      fetchDocuments: vi.fn(async (receiptNumber: string) => {
        if (receiptNumber.endsWith("2")) throw new Error("temporary failure");
        return [document];
      }),
    };

    await expect(syncDisclosureDocuments({ repository, source, concurrency: 2 }, 10)).resolves.toEqual({
      disclosureCount: 2,
      documentCount: 1,
      failedCount: 1,
    });
    expect(repository.saveDocuments).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe collection limits", async () => {
    const repository = { listPending: vi.fn(), markFetching: vi.fn(), saveDocuments: vi.fn(), markFailed: vi.fn() };
    const source = { fetchDocuments: vi.fn() };
    await expect(syncDisclosureDocuments({ repository, source }, 201)).rejects.toBeInstanceOf(RangeError);
  });
});

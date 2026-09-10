export type DisclosureDocumentKind = "MAIN" | "ATTACHMENT";
export type DisclosureDocumentCollectionStatus = "PENDING" | "FETCHING" | "READY" | "UNAVAILABLE" | "FAILED";

export type ExtractedDisclosureDocument = Readonly<{
  sequenceNumber: number;
  kind: DisclosureDocumentKind;
  title: string;
  fileName: string;
  mimeType: "application/xml" | "text/html" | "text/plain";
  byteSize: number;
  contentHash: string;
  contentText: string;
  isTruncated: boolean;
}>;

export type DisclosureDocumentSummary = Readonly<{
  id: string;
  sequenceNumber: number;
  kind: DisclosureDocumentKind;
  title: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  isTruncated: boolean;
}>;

export type DisclosureDocumentDetail = DisclosureDocumentSummary & Readonly<{
  receiptNumber: string;
  reportName: string;
  companyName: string;
  contentText: string;
}>;

export type PendingDisclosureDocumentSource = Readonly<{
  id: string;
  receiptNumber: string;
}>;

export type DisclosureDocumentSyncCounts = Readonly<{
  disclosureCount: number;
  documentCount: number;
  failedCount: number;
}>;

export interface DisclosureDocumentSource {
  fetchDocuments(receiptNumber: string): Promise<readonly ExtractedDisclosureDocument[]>;
}

export interface DisclosureDocumentSyncRepository {
  listPending(limit: number): Promise<readonly PendingDisclosureDocumentSource[]>;
  markFetching(sourceDisclosureId: string): Promise<void>;
  saveDocuments(sourceDisclosureId: string, documents: readonly ExtractedDisclosureDocument[]): Promise<void>;
  markFailed(sourceDisclosureId: string, error: unknown): Promise<void>;
}

export interface DisclosureDocumentRepository {
  findByReceiptNumber(receiptNumber: string): Promise<readonly DisclosureDocumentSummary[]>;
  findCollectionStatus(receiptNumber: string): Promise<DisclosureDocumentCollectionStatus>;
  findDetail(receiptNumber: string, documentId: string): Promise<DisclosureDocumentDetail | null>;
}

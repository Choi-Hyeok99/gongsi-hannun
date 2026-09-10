import type {
  DisclosureDocumentDetail,
  DisclosureDocumentCollectionStatus,
  DisclosureDocumentRepository,
  DisclosureDocumentSummary,
} from "@/domain/disclosure-document";

const RECEIPT_NUMBER = /^[0-9]{14}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function listDisclosureDocuments(
  repository: DisclosureDocumentRepository,
  receiptNumber: string,
): Promise<readonly DisclosureDocumentSummary[]> {
  if (!RECEIPT_NUMBER.test(receiptNumber)) return Promise.resolve([]);
  return repository.findByReceiptNumber(receiptNumber);
}

export function getDisclosureDocumentCollectionStatus(
  repository: DisclosureDocumentRepository,
  receiptNumber: string,
): Promise<DisclosureDocumentCollectionStatus> {
  if (!RECEIPT_NUMBER.test(receiptNumber)) return Promise.resolve("PENDING");
  return repository.findCollectionStatus(receiptNumber);
}

export function getDisclosureDocument(
  repository: DisclosureDocumentRepository,
  receiptNumber: string,
  documentId: string,
): Promise<DisclosureDocumentDetail | null> {
  if (!RECEIPT_NUMBER.test(receiptNumber) || !UUID.test(documentId)) return Promise.resolve(null);
  return repository.findDetail(receiptNumber, documentId);
}

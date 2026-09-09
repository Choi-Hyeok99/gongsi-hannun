import type { DisclosureRepository, DisclosureSummary } from "@/domain/disclosure-query";

const RECEIPT_NUMBER = /^[0-9]{14}$/;

export async function listLatestDisclosures(
  repository: DisclosureRepository,
  limit = 20,
): Promise<readonly DisclosureSummary[]> {
  return repository.findLatest(Math.min(Math.max(limit, 1), 50));
}

export async function getDisclosure(
  repository: DisclosureRepository,
  receiptNumber: string,
): Promise<DisclosureSummary | null> {
  if (!RECEIPT_NUMBER.test(receiptNumber)) return null;
  return repository.findByReceiptNumber(receiptNumber);
}

export async function listCompanyDisclosures(
  repository: DisclosureRepository,
  stockCode: string,
  limit = 10,
): Promise<readonly DisclosureSummary[]> {
  if (!/^[0-9]{6}$/.test(stockCode)) return [];
  return repository.findByCompanyStockCode(stockCode, Math.min(Math.max(limit, 1), 30));
}

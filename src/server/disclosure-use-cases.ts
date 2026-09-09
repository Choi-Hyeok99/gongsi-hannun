import type {
  DisclosureRepository,
  DisclosureSearchResult,
  DisclosureSummary,
} from "@/domain/disclosure-query";
import { isDisclosureEventType, type DisclosureEventType } from "@/domain/disclosure-classification";

const RECEIPT_NUMBER = /^[0-9]{14}$/;

export async function listLatestDisclosures(
  repository: DisclosureRepository,
  limit = 20,
): Promise<readonly DisclosureSummary[]> {
  return repository.findLatest(Math.min(Math.max(limit, 1), 50));
}

export async function searchDisclosures(
  repository: DisclosureRepository,
  rawDate: string | null,
  rawPage: string | null,
  rawEventType: string | null = null,
  rawTerm: string | null = null,
): Promise<DisclosureSearchResult & {
  date: string | null;
  eventType: DisclosureEventType | null;
  term: string | null;
  page: number;
  pageSize: number;
}> {
  const date = isValidDate(rawDate) ? rawDate : null;
  const eventType = isDisclosureEventType(rawEventType) ? rawEventType : null;
  const term = normalizeSearchTerm(rawTerm);
  const parsedPage = Number(rawPage);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 500) : 1;
  const pageSize = 30;
  const result = await repository.search({ date, eventType, term, page, pageSize });
  return { ...result, date, eventType, term, page, pageSize };
}

function normalizeSearchTerm(value: string | null): string | null {
  const normalized = value
    ?.normalize("NFKC")
    .replace(/[,()%_*'"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return normalized || null;
}

function isValidDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month! - 1
    && parsed.getUTCDate() === day;
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

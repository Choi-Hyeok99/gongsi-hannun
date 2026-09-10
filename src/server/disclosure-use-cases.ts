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

export async function listDisclosureCalendar(
  repository: DisclosureRepository,
  rawMonth: string | null,
  today = new Date(),
): Promise<Readonly<{ month: string; items: readonly DisclosureSummary[] }>> {
  const fallbackMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).format(today).slice(0, 7);
  const month = rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : fallbackMonth;
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
  const items = await repository.findByDateRange(`${month}-01`, `${month}-${String(lastDay).padStart(2, "0")}`, 300);
  return { month, items };
}

export function findCorrectionTimeline(
  disclosure: DisclosureSummary,
  candidates: readonly DisclosureSummary[],
): readonly DisclosureSummary[] {
  const key = normalizeCorrectionTitle(disclosure.reportName);
  return candidates
    .filter((candidate) => normalizeCorrectionTitle(candidate.reportName) === key)
    .sort((left, right) => left.disclosedOn.localeCompare(right.disclosedOn) || left.receiptNumber.localeCompare(right.receiptNumber));
}

function normalizeCorrectionTitle(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/(?:기재|첨부)?정정/g, "")
    .replace(/[^가-힣a-z0-9]/gi, "")
    .toLocaleLowerCase("ko-KR");
  const anchors = ["주요사항보고서", "주주총회소집공고", "의결권대리행사권유참고서류", "단일판매공급계약"];
  const anchor = anchors.find((candidate) => normalized.includes(candidate));
  return anchor ? normalized.slice(normalized.indexOf(anchor)) : normalized;
}

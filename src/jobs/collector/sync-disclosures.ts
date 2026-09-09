import type {
  DartCorporationClass,
  DisclosureRecord,
  DisclosureSource,
  DisclosureSyncCounts,
  DisclosureSyncRepository,
} from "@/domain/disclosure";
import { ExternalServiceError } from "@/domain/errors";

const CORP_CLASSES: readonly DartCorporationClass[] = ["Y", "K", "N"];
const MAX_PAGES_PER_CLASS = 100;

type Dependencies = Readonly<{
  source: DisclosureSource;
  repository: DisclosureSyncRepository;
}>;

export async function syncDisclosures(
  dependencies: Dependencies,
  fromDate: string,
  toDate: string,
): Promise<DisclosureSyncCounts> {
  validateDateRange(fromDate, toDate);
  const runId = await dependencies.repository.startRun(fromDate, toDate);
  const records = new Map<string, DisclosureRecord>();

  try {
    for (const corpClass of CORP_CLASSES) {
      const firstPage = await dependencies.source.fetchPage({
        fromDate,
        toDate,
        page: 1,
        corpClass,
      });
      addRecords(records, firstPage.records);
      if (firstPage.totalPages > MAX_PAGES_PER_CLASS) {
        throw new ExternalServiceError("INVALID_RESPONSE", "공시 페이지 수가 안전 한도를 초과했습니다.");
      }
      for (let page = 2; page <= firstPage.totalPages; page += 1) {
        const response = await dependencies.source.fetchPage({
          fromDate,
          toDate,
          page,
          corpClass,
        });
        if (response.page !== page) {
          throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 페이지 번호가 일치하지 않습니다.");
        }
        addRecords(records, response.records);
      }
    }

    const counts = await dependencies.repository.upsertDisclosures([...records.values()]);
    await dependencies.repository.completeRun(runId, counts);
    return counts;
  } catch (error) {
    await dependencies.repository.failRun(runId, records.size, error);
    throw error;
  }
}

function addRecords(target: Map<string, DisclosureRecord>, records: readonly DisclosureRecord[]): void {
  for (const record of records) target.set(record.receiptNumber, record);
}

function validateDateRange(fromDate: string, toDate: string): void {
  if (!/^\d{8}$/.test(fromDate) || !/^\d{8}$/.test(toDate) || fromDate > toDate) {
    throw new RangeError("공시 수집 날짜 범위가 올바르지 않습니다.");
  }
}

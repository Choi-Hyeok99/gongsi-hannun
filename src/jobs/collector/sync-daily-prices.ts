import type {
  DailyPriceRange,
  DailyPriceRecord,
  DailyPriceSource,
  DailyPriceSyncCounts,
  DailyPriceSyncRepository,
} from "@/domain/daily-price";

type Dependencies = Readonly<{
  source: DailyPriceSource;
  repository: DailyPriceSyncRepository;
}>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STOCK_CODE_PATTERN = /^\d{6}$/;
const SOURCE_ID_PATTERN = /^[A-Z0-9_]{2,30}$/;
const POSITIVE_DECIMAL_PATTERN = /^(?:[1-9]\d{0,15})(?:\.\d{1,4})?$/;
const NON_NEGATIVE_INTEGER_PATTERN = /^\d{1,24}$/;

export async function syncDailyPrices(
  dependencies: Dependencies,
  requestedRange: DailyPriceRange,
): Promise<DailyPriceSyncCounts> {
  const range = validateRange(requestedRange);
  validateSourceId(dependencies.source.sourceId);
  const runId = await dependencies.repository.startRun(range, dependencies.source.sourceId);
  let readCount = 0;

  try {
    const fetched = await dependencies.source.fetchDailyPrices(range);
    readCount = fetched.length;
    const prices = deduplicateAndValidate(fetched, range);
    const result = await dependencies.repository.upsertDailyPrices(
      runId,
      dependencies.source.sourceId,
      prices,
    );
    const counts = { readCount, ...result };
    await dependencies.repository.completeRun(runId, counts);
    return counts;
  } catch (error) {
    await dependencies.repository.failRun(runId, readCount, error);
    throw error;
  }
}

function validateRange(range: DailyPriceRange): DailyPriceRange {
  if (!DATE_PATTERN.test(range.from) || !DATE_PATTERN.test(range.to) || range.from > range.to) {
    throw new Error("유효한 일별 주가 조회 기간이 필요합니다.");
  }

  const stockCodes = [...new Set(range.stockCodes)];
  if (stockCodes.length === 0 || stockCodes.some((code) => !STOCK_CODE_PATTERN.test(code))) {
    throw new Error("유효한 6자리 종목코드가 필요합니다.");
  }

  return { stockCodes, from: range.from, to: range.to };
}

function validateSourceId(sourceId: string): void {
  if (!SOURCE_ID_PATTERN.test(sourceId)) {
    throw new Error("주가 공급자 식별자가 올바르지 않습니다.");
  }
}

function deduplicateAndValidate(
  records: readonly DailyPriceRecord[],
  range: DailyPriceRange,
): readonly DailyPriceRecord[] {
  const requestedCodes = new Set(range.stockCodes);
  const unique = new Map<string, DailyPriceRecord>();

  for (const record of records) {
    if (
      !STOCK_CODE_PATTERN.test(record.stockCode)
      || !requestedCodes.has(record.stockCode)
      || !DATE_PATTERN.test(record.tradingDate)
      || record.tradingDate < range.from
      || record.tradingDate > range.to
      || !POSITIVE_DECIMAL_PATTERN.test(record.openPrice)
      || !POSITIVE_DECIMAL_PATTERN.test(record.highPrice)
      || !POSITIVE_DECIMAL_PATTERN.test(record.lowPrice)
      || !POSITIVE_DECIMAL_PATTERN.test(record.closePrice)
      || !NON_NEGATIVE_INTEGER_PATTERN.test(record.volume)
    ) {
      throw new Error("주가 공급자가 유효하지 않은 일별 가격을 반환했습니다.");
    }

    const open = toScaledInteger(record.openPrice);
    const high = toScaledInteger(record.highPrice);
    const low = toScaledInteger(record.lowPrice);
    const close = toScaledInteger(record.closePrice);
    if (high < open || high < low || high < close || low > open || low > high || low > close) {
      throw new Error("주가 공급자가 유효하지 않은 가격 범위를 반환했습니다.");
    }

    unique.set(`${record.stockCode}:${record.tradingDate}`, record);
  }

  return [...unique.values()];
}

function toScaledInteger(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(`${whole}${fraction.padEnd(4, "0")}`);
}

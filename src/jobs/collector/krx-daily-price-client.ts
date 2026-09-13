import { z } from "zod";
import type { DailyPriceRange, DailyPriceRecord, DailyPriceSource } from "@/domain/daily-price";
import { ExternalServiceError } from "@/domain/errors";

const BASE_URL = "https://data-dbg.krx.co.kr/svc/apis/sto";
const MARKET_ENDPOINTS = ["stk_bydd_trd", "ksq_bydd_trd", "knx_bydd_trd"] as const;
const KRX_DATE_PATTERN = /^\d{8}$/;
const KRX_ISSUE_CODE_PATTERN = /^[0-9A-Z]{6}$/;
const INTEGER_PATTERN = /^\d{1,24}$/;

const rowSchema = z.object({
  BAS_DD: z.string().regex(KRX_DATE_PATTERN),
  ISU_CD: z.string().regex(KRX_ISSUE_CODE_PATTERN),
  TDD_CLSPRC: z.string(),
  TDD_OPNPRC: z.string(),
  TDD_HGPRC: z.string(),
  TDD_LWPRC: z.string(),
  ACC_TRDVOL: z.string(),
});

const successSchema = z.object({ OutBlock_1: z.array(rowSchema) });
const errorSchema = z.object({
  respCode: z.union([z.string(), z.number()]).transform(String),
  respMsg: z.string().optional(),
});

type ClientOptions = Readonly<{
  apiKey: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
}>;

export class KrxDailyPriceClient implements DailyPriceSource {
  readonly sourceId = "KRX_DAILY";
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(private readonly options: ClientOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 8_000_000;
  }

  async fetchDailyPrices(range: DailyPriceRange): Promise<readonly DailyPriceRecord[]> {
    const requestedCodes = new Set(range.stockCodes);
    const records: DailyPriceRecord[] = [];

    for (const date of enumerateWeekdays(range.from, range.to)) {
      const krxDate = date.replaceAll("-", "");
      for (const endpoint of MARKET_ENDPOINTS) {
        const rows = await this.fetchMarket(endpoint, krxDate);
        for (const row of rows) {
          if (!requestedCodes.has(row.ISU_CD)) continue;
          records.push(mapRow(row, krxDate));
        }
      }
    }

    return records;
  }

  private async fetchMarket(
    endpoint: (typeof MARKET_ENDPOINTS)[number],
    krxDate: string,
  ): Promise<readonly z.infer<typeof rowSchema>[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = new URL(`${BASE_URL}/${endpoint}`);
      url.searchParams.set("basDd", krxDate);
      const response = await this.fetcher(url, {
        method: "GET",
        headers: { AUTH_KEY: this.options.apiKey, Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new ExternalServiceError(
          "AUTHENTICATION_FAILED",
          "KRX 인증키 또는 해당 시장 API 이용 승인을 확인해 주세요.",
        );
      }
      if (response.status === 429) {
        throw new ExternalServiceError("RATE_LIMITED", "KRX API 요청 한도를 초과했습니다.");
      }
      if (!response.ok) {
        throw new ExternalServiceError("UNAVAILABLE", "KRX API를 일시적으로 사용할 수 없습니다.");
      }

      const payload = await readLimitedJson(response, this.maxResponseBytes);
      const serviceError = errorSchema.safeParse(payload);
      if (serviceError.success) throw mapServiceError(serviceError.data.respCode);

      const parsed = successSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ExternalServiceError("INVALID_RESPONSE", "KRX API 응답 형식이 올바르지 않습니다.");
      }
      return parsed.data.OutBlock_1;
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      if (controller.signal.aborted) {
        throw new ExternalServiceError("TIMEOUT", "KRX API 응답 시간이 초과됐습니다.");
      }
      throw new ExternalServiceError("UNAVAILABLE", "KRX API 통신에 실패했습니다.");
    } finally {
      clearTimeout(timeout);
    }
  }
}

function mapRow(value: z.infer<typeof rowSchema>, requestedDate: string): DailyPriceRecord {
  if (value.BAS_DD !== requestedDate) {
    throw new ExternalServiceError("INVALID_RESPONSE", "KRX API가 요청일과 다른 거래일을 반환했습니다.");
  }
  return {
    stockCode: value.ISU_CD,
    tradingDate: `${value.BAS_DD.slice(0, 4)}-${value.BAS_DD.slice(4, 6)}-${value.BAS_DD.slice(6, 8)}`,
    openPrice: normalizeInteger(value.TDD_OPNPRC),
    highPrice: normalizeInteger(value.TDD_HGPRC),
    lowPrice: normalizeInteger(value.TDD_LWPRC),
    closePrice: normalizeInteger(value.TDD_CLSPRC),
    volume: normalizeInteger(value.ACC_TRDVOL),
  };
}

function normalizeInteger(value: string): string {
  const normalized = value.replaceAll(",", "").trim();
  if (!INTEGER_PATTERN.test(normalized)) {
    throw new ExternalServiceError("INVALID_RESPONSE", "KRX API가 올바르지 않은 숫자를 반환했습니다.");
  }
  return BigInt(normalized).toString();
}

function enumerateWeekdays(from: string, to: string): readonly string[] {
  const result: string[] = [];
  const current = new Date(`${from}T00:00:00.000Z`);
  const last = new Date(`${to}T00:00:00.000Z`);
  while (current <= last) {
    const weekday = current.getUTCDay();
    if (weekday !== 0 && weekday !== 6) result.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}

async function readLimitedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ExternalServiceError("INVALID_RESPONSE", "KRX API 응답이 허용 크기를 초과했습니다.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maximumBytes) {
    throw new ExternalServiceError("INVALID_RESPONSE", "KRX API 응답이 허용 크기를 초과했습니다.");
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new ExternalServiceError("INVALID_RESPONSE", "KRX API JSON을 해석하지 못했습니다.");
  }
}

function mapServiceError(code: string): ExternalServiceError {
  if (code === "401" || code === "403") {
    return new ExternalServiceError(
      "AUTHENTICATION_FAILED",
      "KRX 인증키 또는 해당 시장 API 이용 승인을 확인해 주세요.",
    );
  }
  if (code === "429") {
    return new ExternalServiceError("RATE_LIMITED", "KRX API 요청 한도를 초과했습니다.");
  }
  return new ExternalServiceError("UNAVAILABLE", "KRX API 요청을 완료하지 못했습니다.");
}

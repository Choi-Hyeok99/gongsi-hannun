import { z } from "zod";
import { ExternalServiceError } from "@/domain/errors";

const ENDPOINT = "https://opendart.fss.or.kr/api/list.json";
const responseSchema = z.object({
  status: z.string(),
  message: z.string(),
  list: z.array(z.object({
    corp_code: z.string().regex(/^[0-9]{8}$/),
    corp_name: z.string().min(1),
    stock_code: z.string(),
    report_nm: z.string().min(1),
    rcept_no: z.string().regex(/^[0-9]{14}$/),
    rcept_dt: z.string().regex(/^[0-9]{8}$/),
  })).optional(),
});

export type DisclosureRecord = Readonly<{
  dartCorpCode: string;
  companyName: string;
  stockCode: string | null;
  reportName: string;
  receiptNumber: string;
  disclosedOn: string;
  originalUrl: string;
}>;

export type DisclosureQuery = Readonly<{ fromDate: string; toDate: string; page: number }>;

type ClientOptions = Readonly<{
  apiKey: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
}>;

export class OpenDartClient {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(private readonly options: ClientOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 1_000_000;
  }

  async listDisclosures(query: DisclosureQuery): Promise<readonly DisclosureRecord[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(this.buildUrl(query), { signal: controller.signal, cache: "no-store" });
      if (response.status === 429) throw new ExternalServiceError("RATE_LIMITED", "OpenDART 요청 한도를 초과했습니다.");
      if (!response.ok) throw new ExternalServiceError("UNAVAILABLE", "OpenDART를 일시적으로 사용할 수 없습니다.");
      const payload = responseSchema.safeParse(await readLimitedJson(response, this.maxResponseBytes));
      if (!payload.success) throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 응답 형식이 올바르지 않습니다.");
      if (payload.data.status === "013") return [];
      if (payload.data.status === "020") throw new ExternalServiceError("RATE_LIMITED", "OpenDART 요청 한도를 초과했습니다.");
      if (payload.data.status !== "000") throw new ExternalServiceError("UNAVAILABLE", "OpenDART 요청을 완료하지 못했습니다.");
      return (payload.data.list ?? []).map(mapDisclosure);
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      if (controller.signal.aborted) throw new ExternalServiceError("TIMEOUT", "OpenDART 응답 시간이 초과됐습니다.");
      throw new ExternalServiceError("UNAVAILABLE", "OpenDART 통신에 실패했습니다.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(query: DisclosureQuery): URL {
    const url = new URL(ENDPOINT);
    url.searchParams.set("crtfc_key", this.options.apiKey);
    url.searchParams.set("bgn_de", query.fromDate);
    url.searchParams.set("end_de", query.toDate);
    url.searchParams.set("page_no", String(query.page));
    url.searchParams.set("page_count", "100");
    return url;
  }
}

async function readLimitedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 응답이 허용 크기를 초과했습니다.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maximumBytes) throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 응답이 허용 크기를 초과했습니다.");
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART JSON을 해석하지 못했습니다."); }
}

type OpenDartDisclosure = NonNullable<z.infer<typeof responseSchema>["list"]>[number];

function mapDisclosure(value: OpenDartDisclosure): DisclosureRecord {
  return {
    dartCorpCode: value.corp_code,
    companyName: value.corp_name,
    stockCode: value.stock_code || null,
    reportName: value.report_nm,
    receiptNumber: value.rcept_no,
    disclosedOn: `${value.rcept_dt.slice(0, 4)}-${value.rcept_dt.slice(4, 6)}-${value.rcept_dt.slice(6, 8)}`,
    originalUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${value.rcept_no}`,
  };
}

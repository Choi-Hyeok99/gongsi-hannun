import { z } from "zod";
import type { CompanyIndustryProfile, CompanyIndustrySource } from "@/domain/company-industry-sync";
import type { Market } from "@/domain/company";
import { ExternalServiceError } from "@/domain/errors";

const ENDPOINT = "https://opendart.fss.or.kr/api/company.json";
const DEFAULT_MAX_RESPONSE_BYTES = 100_000;

const responseSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
  corp_cls: z.enum(["Y", "K", "N", "E"]).optional(),
  induty_code: z.string().trim().optional().default(""),
});

const MARKET_BY_CORPORATION_CLASS: Readonly<Record<"Y" | "K" | "N" | "E", Market>> = {
  Y: "KOSPI",
  K: "KOSDAQ",
  N: "KONEX",
  E: "OTHER",
};

type ClientOptions = Readonly<{
  apiKey: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
}>;

export class OpenDartCompanyProfileClient implements CompanyIndustrySource {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(private readonly options: ClientOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  }

  async fetchProfile(dartCorpCode: string): Promise<CompanyIndustryProfile | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(this.buildUrl(dartCorpCode), {
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status === 429) throw rateLimitError();
      if (!response.ok) throw new ExternalServiceError("UNAVAILABLE", "OpenDART 기업개황을 가져오지 못했습니다.");

      const parsed = responseSchema.safeParse(await readLimitedJson(response, this.maxResponseBytes));
      if (!parsed.success) throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 기업개황 형식이 올바르지 않습니다.");
      if (parsed.data.status === "013") return null;
      if (parsed.data.status === "020") throw rateLimitError();
      if (parsed.data.status !== "000" || !parsed.data.corp_cls) {
        throw new ExternalServiceError("UNAVAILABLE", "OpenDART 기업개황 요청을 완료하지 못했습니다.");
      }

      const industryCode = parsed.data.induty_code;
      return {
        dartCorpCode,
        industryCode: /^[0-9]{2,6}$/.test(industryCode) ? industryCode : null,
        market: MARKET_BY_CORPORATION_CLASS[parsed.data.corp_cls],
      };
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      if (controller.signal.aborted) {
        throw new ExternalServiceError("TIMEOUT", "OpenDART 기업개황 응답 시간이 초과됐습니다.");
      }
      throw new ExternalServiceError("UNAVAILABLE", "OpenDART 기업개황 통신에 실패했습니다.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(dartCorpCode: string): URL {
    const url = new URL(ENDPOINT);
    url.searchParams.set("crtfc_key", this.options.apiKey);
    url.searchParams.set("corp_code", dartCorpCode);
    return url;
  }
}

function rateLimitError(): ExternalServiceError {
  return new ExternalServiceError("RATE_LIMITED", "OpenDART 요청 한도를 초과했습니다.");
}

async function readLimitedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 응답이 허용 크기를 초과했습니다.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maximumBytes) {
    throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 응답이 허용 크기를 초과했습니다.");
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART JSON을 해석하지 못했습니다.");
  }
}

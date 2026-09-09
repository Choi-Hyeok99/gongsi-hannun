import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { CompanyDirectoryRecord, CompanyDirectorySource } from "@/domain/company-sync";
import { ExternalServiceError } from "@/domain/errors";

const ENDPOINT = "https://opendart.fss.or.kr/api/corpCode.xml";
const DEFAULT_MAX_DOWNLOAD_BYTES = 20_000_000;
const DEFAULT_MAX_UNCOMPRESSED_BYTES = 80_000_000;

const companySchema = z.object({
  corp_code: z.string().regex(/^[0-9]{8}$/),
  corp_name: z.string().trim().min(1).max(200),
  corp_eng_name: z.string().trim().max(300).optional().default(""),
  stock_code: z.string().trim().optional().default(""),
  modify_date: z.string().regex(/^[0-9]{8}$/),
});

const directorySchema = z.object({
  result: z.object({ list: z.array(companySchema).min(1) }),
});

const errorSchema = z.object({
  result: z.object({
    status: z.string(),
    message: z.string().optional(),
  }),
});

type ClientOptions = Readonly<{
  apiKey: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxDownloadBytes?: number;
  maxUncompressedBytes?: number;
}>;

export class OpenDartCompanyClient implements CompanyDirectorySource {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxDownloadBytes: number;
  private readonly maxUncompressedBytes: number;

  constructor(private readonly options: ClientOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxDownloadBytes = options.maxDownloadBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES;
    this.maxUncompressedBytes = options.maxUncompressedBytes ?? DEFAULT_MAX_UNCOMPRESSED_BYTES;
  }

  async fetchDirectory(): Promise<readonly CompanyDirectoryRecord[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(this.buildUrl(), {
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status === 429) {
        throw new ExternalServiceError("RATE_LIMITED", "OpenDART 요청 한도를 초과했습니다.");
      }
      if (!response.ok) {
        throw new ExternalServiceError("UNAVAILABLE", "OpenDART 기업 목록을 가져오지 못했습니다.");
      }

      const archive = await readLimitedBytes(response, this.maxDownloadBytes);
      if (!isZipArchive(archive)) {
        throwOpenDartXmlError(archive);
      }

      assertSafeArchive(archive, this.maxUncompressedBytes);
      const entries = unzipSync(archive, {
        filter: (file) => file.name.toLowerCase().endsWith("corpcode.xml"),
      });
      const xmlEntry = Object.entries(entries).find(([name]) =>
        name.toLowerCase().endsWith("corpcode.xml"),
      );
      if (!xmlEntry) {
        throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 기업 XML 파일이 없습니다.");
      }

      return parseCompanyDirectory(new TextDecoder("utf-8", { fatal: true }).decode(xmlEntry[1]));
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      if (controller.signal.aborted) {
        throw new ExternalServiceError("TIMEOUT", "OpenDART 기업 목록 응답 시간이 초과됐습니다.");
      }
      throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 기업 목록을 해석하지 못했습니다.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(): URL {
    const url = new URL(ENDPOINT);
    url.searchParams.set("crtfc_key", this.options.apiKey);
    return url;
  }
}

async function readLimitedBytes(response: Response, maximumBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 파일이 허용 크기를 초과했습니다.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maximumBytes) {
    throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 파일이 허용 크기를 초과했습니다.");
  }
  return bytes;
}

function isZipArchive(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && bytes[2] === 0x03
    && bytes[3] === 0x04;
}

function parseCompanyDirectory(xml: string): readonly CompanyDirectoryRecord[] {
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    processEntities: false,
    trimValues: true,
    isArray: (_name, path) => path === "result.list",
  });
  const parsed = directorySchema.safeParse(parser.parse(xml));
  if (!parsed.success) {
    throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 기업 XML 형식이 올바르지 않습니다.");
  }

  const unique = new Map<string, CompanyDirectoryRecord>();
  for (const company of parsed.data.result.list) {
    const stockCode = /^[0-9]{6}$/.test(company.stock_code) ? company.stock_code : null;
    unique.set(company.corp_code, {
      dartCorpCode: company.corp_code,
      nameKo: company.corp_name,
      nameEn: company.corp_eng_name || null,
      stockCode,
      sourceUpdatedOn: formatDate(company.modify_date),
    });
  }
  return [...unique.values()];
}

function throwOpenDartXmlError(bytes: Uint8Array): never {
  try {
    const parser = new XMLParser({ parseTagValue: false, processEntities: false });
    const parsed = errorSchema.safeParse(parser.parse(new TextDecoder().decode(bytes)));
    if (parsed.success && parsed.data.result.status === "020") {
      throw new ExternalServiceError("RATE_LIMITED", "OpenDART 요청 한도를 초과했습니다.");
    }
    if (parsed.success) {
      throw new ExternalServiceError("UNAVAILABLE", "OpenDART 기업 목록 요청을 완료하지 못했습니다.");
    }
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
  }
  throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART ZIP 응답 형식이 올바르지 않습니다.");
}

function formatDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function assertSafeArchive(bytes: Uint8Array, maximumUncompressedBytes: number): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const directorySize = view.getUint32(eocdOffset + 12, true);
  const directoryOffset = view.getUint32(eocdOffset + 16, true);

  if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new ExternalServiceError("INVALID_RESPONSE", "지원하지 않는 ZIP64 형식입니다.");
  }
  if (directoryOffset + directorySize > eocdOffset) {
    throw new ExternalServiceError("INVALID_RESPONSE", "ZIP 중앙 디렉터리가 손상됐습니다.");
  }

  let offset = directoryOffset;
  let totalUncompressedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > eocdOffset || view.getUint32(offset, true) !== 0x02014b50) {
      throw new ExternalServiceError("INVALID_RESPONSE", "ZIP 항목 정보가 손상됐습니다.");
    }
    const uncompressedBytes = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (uncompressedBytes === 0xffffffff) {
      throw new ExternalServiceError("INVALID_RESPONSE", "지원하지 않는 ZIP64 항목입니다.");
    }
    totalUncompressedBytes += uncompressedBytes;
    if (totalUncompressedBytes > maximumUncompressedBytes) {
      throw new ExternalServiceError("INVALID_RESPONSE", "압축 해제 크기가 허용 범위를 초과했습니다.");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimumOffset = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new ExternalServiceError("INVALID_RESPONSE", "ZIP 종료 정보를 찾지 못했습니다.");
}

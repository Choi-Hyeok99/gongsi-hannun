import { createHash } from "node:crypto";
import { Unzip, UnzipInflate } from "fflate";
import type { DisclosureDocumentSource, ExtractedDisclosureDocument } from "@/domain/disclosure-document";
import { ExternalServiceError } from "@/domain/errors";

const ENDPOINT = "https://opendart.fss.or.kr/api/document.xml";
const RECEIPT_NUMBER = /^[0-9]{14}$/;
const SAFE_FILE_NAME = /^[^\\/\u0000-\u001f]{1,300}$/;
const MIME_TYPES: ReadonlyMap<string, ExtractedDisclosureDocument["mimeType"]> = new Map([
  ["xml", "application/xml"],
  ["xhtml", "application/xml"],
  ["html", "text/html"],
  ["htm", "text/html"],
  ["txt", "text/plain"],
] as const);

type ClientOptions = Readonly<{
  apiKey: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxArchiveBytes?: number;
  maxExpandedBytes?: number;
  maxStoredBytesPerDocument?: number;
  maxDocuments?: number;
}>;

type ExtractOptions = Required<Pick<ClientOptions, "maxExpandedBytes" | "maxStoredBytesPerDocument" | "maxDocuments">>;

export class OpenDartDocumentClient implements DisclosureDocumentSource {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxArchiveBytes: number;
  private readonly extractOptions: ExtractOptions;

  constructor(private readonly options: ClientOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 12_000;
    this.maxArchiveBytes = options.maxArchiveBytes ?? 20_000_000;
    this.extractOptions = {
      maxExpandedBytes: options.maxExpandedBytes ?? 50_000_000,
      maxStoredBytesPerDocument: options.maxStoredBytesPerDocument ?? 4_000_000,
      maxDocuments: options.maxDocuments ?? 100,
    };
  }

  async fetchDocuments(receiptNumber: string): Promise<readonly ExtractedDisclosureDocument[]> {
    if (!RECEIPT_NUMBER.test(receiptNumber)) throw new RangeError("OpenDART 접수번호가 올바르지 않습니다.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(this.buildUrl(receiptNumber), {
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status === 429) throw new ExternalServiceError("RATE_LIMITED", "OpenDART 요청 한도를 초과했습니다.");
      if (!response.ok) throw new ExternalServiceError("UNAVAILABLE", "OpenDART 원문을 가져오지 못했습니다.");
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > this.maxArchiveBytes) {
        throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 원문 압축파일이 안전 한도를 초과했습니다.");
      }
      const archive = new Uint8Array(await response.arrayBuffer());
      if (archive.byteLength > this.maxArchiveBytes) {
        throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 원문 압축파일이 안전 한도를 초과했습니다.");
      }
      if (!isZip(archive)) return handleOpenDartError(archive);
      return extractDocuments(archive, this.extractOptions);
    } catch (error) {
      if (error instanceof ExternalServiceError || error instanceof RangeError) throw error;
      if (controller.signal.aborted) throw new ExternalServiceError("TIMEOUT", "OpenDART 원문 응답 시간이 초과됐습니다.");
      throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 원문 파일을 해석하지 못했습니다.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(receiptNumber: string): URL {
    const url = new URL(ENDPOINT);
    url.searchParams.set("crtfc_key", this.options.apiKey);
    url.searchParams.set("rcept_no", receiptNumber);
    return url;
  }
}

function extractDocuments(archive: Uint8Array, options: ExtractOptions): readonly ExtractedDisclosureDocument[] {
  const documents: ExtractedDisclosureDocument[] = [];
  let expandedBytes = 0;
  let extractionError: Error | null = null;
  const unzipper = new Unzip((file) => {
    if (extractionError) return;
    const fileName = file.name.split("/").at(-1) ?? "";
    const extension = fileName.split(".").at(-1)?.toLowerCase() ?? "";
    const mimeType = MIME_TYPES.get(extension);
    if (!mimeType || file.name !== fileName || !SAFE_FILE_NAME.test(fileName) || file.name.includes("..")) return;
    if (documents.length >= options.maxDocuments) {
      extractionError = new ExternalServiceError("INVALID_RESPONSE", "OpenDART 원문 문서 수가 안전 한도를 초과했습니다.");
      return;
    }

    const chunks: Uint8Array[] = [];
    const hash = createHash("sha256");
    let documentBytes = 0;
    let storedBytes = 0;
    let truncated = false;
    file.ondata = (error, chunk, final) => {
      if (extractionError) return;
      if (error) {
        extractionError = new ExternalServiceError("INVALID_RESPONSE", "OpenDART 원문 압축을 해제하지 못했습니다.");
        return;
      }
      documentBytes += chunk.byteLength;
      expandedBytes += chunk.byteLength;
      if (expandedBytes > options.maxExpandedBytes) {
        extractionError = new ExternalServiceError("INVALID_RESPONSE", "OpenDART 원문 압축 해제 크기가 안전 한도를 초과했습니다.");
        file.terminate();
        return;
      }
      hash.update(chunk);
      const remaining = options.maxStoredBytesPerDocument - storedBytes;
      if (remaining > 0) {
        const kept = chunk.subarray(0, remaining);
        chunks.push(kept);
        storedBytes += kept.byteLength;
      }
      if (chunk.byteLength > remaining) truncated = true;
      if (!final) return;
      const decoded = decodeDocument(concatenate(chunks, storedBytes));
      const contentText = toPlainText(decoded);
      const sequenceNumber = documents.length + 1;
      documents.push({
        sequenceNumber,
        kind: sequenceNumber === 1 ? "MAIN" : "ATTACHMENT",
        title: extractTitle(decoded, fileName),
        fileName,
        mimeType,
        byteSize: documentBytes,
        contentHash: hash.digest("hex"),
        contentText,
        isTruncated: truncated,
      });
    };
    file.start();
  });
  unzipper.register(UnzipInflate);
  unzipper.push(archive, true);
  if (extractionError) throw extractionError;
  return documents;
}

function handleOpenDartError(payload: Uint8Array): readonly ExtractedDisclosureDocument[] {
  const body = new TextDecoder().decode(payload.subarray(0, 4_096));
  const status = body.match(/<status>\s*([^<]+)\s*<\/status>/i)?.[1]?.trim();
  if (status === "013" || status === "014") return [];
  if (status === "010" || status === "011" || status === "012") {
    throw new ExternalServiceError("AUTHENTICATION_FAILED", "OpenDART 인증키 또는 접근 설정을 확인해 주세요.");
  }
  if (status === "020") throw new ExternalServiceError("RATE_LIMITED", "OpenDART 요청 한도를 초과했습니다.");
  throw new ExternalServiceError("INVALID_RESPONSE", "OpenDART 원문 응답 형식이 올바르지 않습니다.");
}

function isZip(value: Uint8Array): boolean {
  return value.byteLength >= 4 && value[0] === 0x50 && value[1] === 0x4b;
}

function concatenate(chunks: readonly Uint8Array[], length: number): Uint8Array {
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function decodeDocument(value: Uint8Array): string {
  const header = new TextDecoder("ascii").decode(value.subarray(0, 256));
  const declared = header.match(/encoding=["']([^"']+)["']/i)?.[1]?.toLowerCase();
  const encoding = declared === "euc-kr" || declared === "ks_c_5601-1987" ? "euc-kr" : "utf-8";
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(value);
  } catch {
    // Some legacy DART files declare UTF-8 while their Korean text is CP949/EUC-KR.
    return new TextDecoder("euc-kr").decode(value);
  }
}

function extractTitle(value: string, fallbackFileName: string): string {
  const candidates = [
    /<DOCUMENT-NAME[^>]*>([\s\S]*?)<\/DOCUMENT-NAME>/i,
    /<TITLE[^>]*>([\s\S]*?)<\/TITLE>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ];
  for (const pattern of candidates) {
    const title = normalizeText(decodeEntities(value.match(pattern)?.[1]?.replace(/<[^>]+>/g, " ") ?? ""));
    if (title) return title.slice(0, 500);
  }
  return fallbackFileName.replace(/\.[^.]+$/, "").slice(0, 500) || "공시 문서";
}

function toPlainText(value: string): string {
  const withoutUnsafeBlocks = value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|hr)\s*\/?\s*>/gi, "\n")
    .replace(/<\/?(p|div|section|article|header|footer|table|tr|ul|ol|li|h[1-6])[^>]*>/gi, "\n")
    .replace(/<\/?(td|th)[^>]*>/gi, "\t")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutUnsafeBlocks)
    .replace(/\r/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => safeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => safeCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

function safeCodePoint(value: number): string {
  return Number.isInteger(value) && value >= 0x20 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
    ? String.fromCodePoint(value)
    : "";
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

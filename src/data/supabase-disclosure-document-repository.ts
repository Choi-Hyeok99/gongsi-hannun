import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  DisclosureDocumentDetail,
  DisclosureDocumentCollectionStatus,
  DisclosureDocumentRepository,
  DisclosureDocumentSummary,
} from "@/domain/disclosure-document";
import { DataAccessError } from "@/domain/errors";
import { readServerEnvironment } from "@/server/env";

type SummaryRow = {
  id: string;
  sequence_no: number;
  document_kind: DisclosureDocumentSummary["kind"];
  title: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  is_truncated: boolean;
};

type DetailRow = SummaryRow & {
  content_text: string;
  source_disclosures: {
    receipt_no: string;
    report_name: string;
    companies: { name_ko: string } | readonly { name_ko: string }[];
  } | readonly {
    receipt_no: string;
    report_name: string;
    companies: { name_ko: string } | readonly { name_ko: string }[];
  }[];
};

const SUMMARY_SELECTION = "id,sequence_no,document_kind,title,file_name,mime_type,byte_size,is_truncated";

export class SupabaseDisclosureDocumentRepository implements DisclosureDocumentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByReceiptNumber(receiptNumber: string): Promise<readonly DisclosureDocumentSummary[]> {
    const { data, error } = await this.client
      .from("disclosure_documents")
      .select(`${SUMMARY_SELECTION},source_disclosures!inner(receipt_no)`)
      .eq("source_disclosures.receipt_no", receiptNumber)
      .order("sequence_no", { ascending: true });
    if (isMissingTable(error)) return [];
    if (error) throw new DataAccessError("공시 문서 목록을 조회하지 못했습니다.");
    return ((data ?? []) as unknown as SummaryRow[]).map(mapSummary);
  }

  async findCollectionStatus(receiptNumber: string): Promise<DisclosureDocumentCollectionStatus> {
    const { data, error } = await this.client
      .from("source_disclosures")
      .select("content_fetch_status")
      .eq("receipt_no", receiptNumber)
      .maybeSingle();
    if (isMissingTable(error) || error?.code === "42703" || error?.code === "PGRST204") return "PENDING";
    if (error || !data) return "PENDING";
    const status = String(data.content_fetch_status);
    return isCollectionStatus(status) ? status : "PENDING";
  }

  async findDetail(receiptNumber: string, documentId: string): Promise<DisclosureDocumentDetail | null> {
    const { data, error } = await this.client
      .from("disclosure_documents")
      .select(`${SUMMARY_SELECTION},content_text,source_disclosures!inner(receipt_no,report_name,companies!inner(name_ko))`)
      .eq("id", documentId)
      .eq("source_disclosures.receipt_no", receiptNumber)
      .maybeSingle();
    if (isMissingTable(error)) return null;
    if (error) throw new DataAccessError("공시 문서 내용을 조회하지 못했습니다.");
    if (!data) return null;
    const row = data as unknown as DetailRow;
    const disclosure = first(row.source_disclosures);
    const company = disclosure ? first(disclosure.companies) : null;
    if (!disclosure || !company) throw new DataAccessError("공시 문서 연결 정보가 올바르지 않습니다.");
    return {
      ...mapSummary(row),
      receiptNumber: disclosure.receipt_no,
      reportName: disclosure.report_name,
      companyName: company.name_ko,
      contentText: row.content_text,
    };
  }
}

export function createDisclosureDocumentRepository(): DisclosureDocumentRepository {
  const environment = readServerEnvironment();
  return new SupabaseDisclosureDocumentRepository(
    createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  );
}

function mapSummary(row: SummaryRow): DisclosureDocumentSummary {
  return {
    id: row.id,
    sequenceNumber: row.sequence_no,
    kind: row.document_kind,
    title: row.title,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    isTruncated: row.is_truncated,
  };
}

function first<T>(value: T | readonly T[]): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value as T;
}

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function isCollectionStatus(value: string): value is DisclosureDocumentCollectionStatus {
  return ["PENDING", "FETCHING", "READY", "UNAVAILABLE", "FAILED"].includes(value);
}

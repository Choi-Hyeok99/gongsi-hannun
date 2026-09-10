import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  DisclosureDocumentSyncRepository,
  ExtractedDisclosureDocument,
  PendingDisclosureDocumentSource,
} from "@/domain/disclosure-document";
import { DataAccessError } from "@/domain/errors";

type RepositoryOptions = Readonly<{
  supabaseUrl: string;
  supabaseSecretKey: string;
}>;

export class SupabaseDisclosureDocumentSyncRepository implements DisclosureDocumentSyncRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listPending(limit: number): Promise<readonly PendingDisclosureDocumentSource[]> {
    const { data, error } = await this.client
      .from("source_disclosures")
      .select("id,receipt_no,events!inner(visibility)")
      .eq("events.visibility", "PUBLIC")
      .in("content_fetch_status", ["PENDING", "FETCHING", "FAILED"])
      .order("disclosed_on", { ascending: false })
      .limit(limit);
    if (error) throw new DataAccessError("원문 수집 대상 공시를 조회하지 못했습니다.");
    return (data ?? []).map((row) => ({ id: String(row.id), receiptNumber: String(row.receipt_no) }));
  }

  async markFetching(sourceDisclosureId: string): Promise<void> {
    const { error } = await this.client
      .from("source_disclosures")
      .update({ content_fetch_status: "FETCHING", content_fetch_error: null })
      .eq("id", sourceDisclosureId);
    if (error) throw new DataAccessError("공시 원문 수집 상태를 갱신하지 못했습니다.");
  }

  async saveDocuments(sourceDisclosureId: string, documents: readonly ExtractedDisclosureDocument[]): Promise<void> {
    if (documents.length > 0) {
      const rows = documents.map((document) => ({
        source_disclosure_id: sourceDisclosureId,
        sequence_no: document.sequenceNumber,
        document_kind: document.kind,
        title: document.title,
        file_name: document.fileName,
        mime_type: document.mimeType,
        byte_size: document.byteSize,
        content_hash: document.contentHash,
        content_text: document.contentText,
        is_truncated: document.isTruncated,
        fetched_at: new Date().toISOString(),
      }));
      const { error } = await this.client
        .from("disclosure_documents")
        .upsert(rows, { onConflict: "source_disclosure_id,file_name" });
      if (error) throw new DataAccessError("공시 원문 문서를 저장하지 못했습니다.");
    }
    const { error } = await this.client
      .from("source_disclosures")
      .update({
        content_fetched_at: new Date().toISOString(),
        content_fetch_status: documents.length > 0 ? "READY" : "UNAVAILABLE",
        content_fetch_error: null,
      })
      .eq("id", sourceDisclosureId);
    if (error) throw new DataAccessError("공시 원문 수집 상태를 저장하지 못했습니다.");
  }

  async markFailed(sourceDisclosureId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : "원문 수집 실패";
    await this.client
      .from("source_disclosures")
      .update({ content_fetch_status: "FAILED", content_fetch_error: message.slice(0, 500) })
      .eq("id", sourceDisclosureId);
  }
}

export function createSupabaseDisclosureDocumentSyncRepository(
  options: RepositoryOptions,
): DisclosureDocumentSyncRepository {
  return new SupabaseDisclosureDocumentSyncRepository(
    createClient(options.supabaseUrl, options.supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  );
}

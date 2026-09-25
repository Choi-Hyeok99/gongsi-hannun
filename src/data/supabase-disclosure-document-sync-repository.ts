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
    const priorityLimit = Math.max(1, Math.ceil(limit * 0.75));
    const priority = await this.client
      .from("source_disclosures")
      .select("id,receipt_no,events!inner(visibility,rule_importance_score)")
      .eq("events.visibility", "PUBLIC")
      .gte("events.rule_importance_score", 85)
      .in("content_fetch_status", ["PENDING", "FETCHING", "FAILED"])
      .order("disclosed_on", { ascending: false })
      .limit(priorityLimit);
    if (priority.error) throw new DataAccessError("중요 공시 원문 수집 대상을 조회하지 못했습니다.");

    const selected = new Map<string, PendingDisclosureDocumentSource>();
    for (const row of priority.data ?? []) selected.set(String(row.id), toPendingSource(row));
    if (selected.size < limit) {
      const backlog = await this.client
        .from("source_disclosures")
        .select("id,receipt_no,events!inner(visibility)")
        .eq("events.visibility", "PUBLIC")
        .in("content_fetch_status", ["PENDING", "FETCHING", "FAILED"])
        .order("disclosed_on", { ascending: true })
        .order("receipt_no", { ascending: true })
        .limit(limit + selected.size);
      if (backlog.error) throw new DataAccessError("대기 공시 원문 수집 대상을 조회하지 못했습니다.");
      for (const row of backlog.data ?? []) {
        selected.set(String(row.id), toPendingSource(row));
        if (selected.size >= limit) break;
      }
    }
    return [...selected.values()].slice(0, limit);
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

function toPendingSource(row: Readonly<{ id: unknown; receipt_no: unknown }>): PendingDisclosureDocumentSource {
  return { id: String(row.id), receiptNumber: String(row.receipt_no) };
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

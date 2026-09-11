import "server-only";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AiAnalysisCandidate,
  AiAnalysisRepository,
  AiDisclosureSummary,
  AiDisclosureSummaryProvider,
  GeneratedAiDisclosureSummary,
} from "@/domain/ai-disclosure-summary";
import { isDisclosureEventType } from "@/domain/disclosure-classification";
import { DataAccessError } from "@/domain/errors";
import { readServerEnvironment } from "@/server/env";

type JsonObject = Record<string, unknown>;

export class SupabaseAiAnalysisRepository implements AiAnalysisRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findCandidates(limit: number, analysisVersion: string): Promise<readonly AiAnalysisCandidate[]> {
    const { data, error } = await this.client
      .from("events")
      .select("id,event_type,rule_importance_score,source_disclosures!inner(receipt_no,report_name,disclosed_on,companies!inner(name_ko),disclosure_documents(id,document_kind,sequence_no,content_text,content_sha256))")
      .eq("visibility", "PUBLIC")
      .order("occurred_on", { ascending: false })
      .limit(Math.max(limit * 4, limit));
    if (error) throw new DataAccessError("AI 분석 대상 공시를 조회하지 못했습니다.");

    const rows = (data ?? []) as unknown as JsonObject[];
    const eventIds = rows.map((row) => String(row.id));
    const existing = await this.findExistingStates(eventIds, analysisVersion);
    const candidates: AiAnalysisCandidate[] = [];

    for (const row of rows) {
      const eventId = String(row.id);
      const state = existing.get(eventId);
      if (state && state.status !== "FAILED") continue;
      if (state && state.attemptCount >= 3) continue;
      const eventType = String(row.event_type);
      if (!isDisclosureEventType(eventType)) continue;
      const disclosure = firstObject(row.source_disclosures);
      const company = disclosure ? firstObject(disclosure.companies) : null;
      const documents = disclosure ? objectArray(disclosure.disclosure_documents) : [];
      const mainDocument = documents
        .slice()
        .sort((left, right) => Number(left.sequence_no) - Number(right.sequence_no))
        .find((document) => document.document_kind === "MAIN") ?? documents[0];
      const contentText = typeof mainDocument?.content_text === "string" ? mainDocument.content_text.trim() : "";
      if (!disclosure || !company || !mainDocument || !contentText) continue;
      const receiptNumber = String(disclosure.receipt_no);
      const reportName = String(disclosure.report_name);
      const contentHash = String(mainDocument.content_sha256 ?? "");
      candidates.push({
        eventId,
        receiptNumber,
        companyName: String(company.name_ko),
        reportName,
        disclosedOn: String(disclosure.disclosed_on),
        eventType,
        ruleImportanceScore: Number(row.rule_importance_score),
        contentText,
        inputHash: createHash("sha256").update(`${analysisVersion}:${receiptNumber}:${reportName}:${contentHash}:${contentText.length}`).digest("hex"),
      });
      if (candidates.length >= limit) break;
    }
    return candidates;
  }

  async begin(candidate: AiAnalysisCandidate, analysisVersion: string): Promise<boolean> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
    const row = {
      event_id: candidate.eventId,
      analysis_version: analysisVersion,
      status: "PROCESSING",
      input_hash: candidate.inputHash,
      attempt_count: 1,
      locked_at: now.toISOString(),
      lease_expires_at: leaseExpiresAt,
      error_code: null,
    };
    const { error } = await this.client.from("ai_analyses").insert(row);
    if (!error) return true;
    if (error.code !== "23505") throw new DataAccessError("AI 분석 작업을 시작하지 못했습니다.");

    const { data: existing, error: readError } = await this.client
      .from("ai_analyses")
      .select("id,status,attempt_count")
      .eq("event_id", candidate.eventId)
      .eq("analysis_version", analysisVersion)
      .maybeSingle();
    if (readError || !existing || existing.status !== "FAILED" || Number(existing.attempt_count) >= 3) return false;
    const { data: updated, error: updateError } = await this.client
      .from("ai_analyses")
      .update({ ...row, attempt_count: Number(existing.attempt_count) + 1 })
      .eq("id", existing.id)
      .eq("status", "FAILED")
      .select("id")
      .maybeSingle();
    if (updateError) throw new DataAccessError("AI 분석 재시도를 시작하지 못했습니다.");
    return Boolean(updated);
  }

  async complete(eventId: string, analysisVersion: string, provider: AiDisclosureSummaryProvider, summary: GeneratedAiDisclosureSummary): Promise<void> {
    const { error } = await this.client.from("ai_analyses").update({
      status: "SUCCEEDED",
      model_provider: provider.providerName,
      model_name: provider.modelName,
      plain_summary: summary.plainSummary,
      why_it_matters: summary.whyItMatters,
      checkpoints: summary.checkpoints,
      cautions: summary.cautions,
      ai_importance_score: summary.importanceScore,
      generated_at: new Date().toISOString(),
      locked_at: null,
      lease_expires_at: null,
      error_code: null,
    }).eq("event_id", eventId).eq("analysis_version", analysisVersion).eq("status", "PROCESSING");
    if (error) throw new DataAccessError("AI 분석 결과를 저장하지 못했습니다.");
  }

  async fail(eventId: string, analysisVersion: string, errorCode: string): Promise<void> {
    const { error } = await this.client.from("ai_analyses").update({
      status: "FAILED",
      error_code: errorCode,
      locked_at: null,
      lease_expires_at: null,
    }).eq("event_id", eventId).eq("analysis_version", analysisVersion).eq("status", "PROCESSING");
    if (error) throw new DataAccessError("AI 분석 실패 상태를 저장하지 못했습니다.");
  }

  async findPublishedByReceiptNumber(receiptNumber: string): Promise<AiDisclosureSummary | null> {
    const { data, error } = await this.client
      .from("ai_analyses")
      .select("plain_summary,why_it_matters,checkpoints,cautions,ai_importance_score,generated_at,events!inner(source_disclosures!inner(receipt_no))")
      .eq("status", "SUCCEEDED")
      .eq("events.source_disclosures.receipt_no", receiptNumber)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new DataAccessError("AI 요약을 조회하지 못했습니다.");
    if (!data) return null;
    return {
      plainSummary: String(data.plain_summary),
      whyItMatters: String(data.why_it_matters ?? ""),
      checkpoints: stringArray(data.checkpoints),
      cautions: stringArray(data.cautions),
      importanceScore: Number(data.ai_importance_score ?? 0),
      generatedAt: String(data.generated_at),
    };
  }

  private async findExistingStates(eventIds: readonly string[], analysisVersion: string) {
    const states = new Map<string, Readonly<{ status: string; attemptCount: number }>>();
    if (eventIds.length === 0) return states;
    const { data, error } = await this.client.from("ai_analyses").select("event_id,status,attempt_count").eq("analysis_version", analysisVersion).in("event_id", eventIds);
    if (error) throw new DataAccessError("기존 AI 분석 상태를 조회하지 못했습니다.");
    for (const row of data ?? []) states.set(String(row.event_id), { status: String(row.status), attemptCount: Number(row.attempt_count) });
    return states;
  }
}

export function createAiAnalysisRepository(): AiAnalysisRepository {
  const environment = readServerEnvironment();
  return new SupabaseAiAnalysisRepository(createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  }));
}

function objectArray(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonObject => Boolean(item) && typeof item === "object");
  return value && typeof value === "object" ? [value as JsonObject] : [];
}

function firstObject(value: unknown): JsonObject | null {
  return objectArray(value)[0] ?? null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

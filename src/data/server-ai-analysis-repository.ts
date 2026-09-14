import "server-only";
import { createClient } from "@supabase/supabase-js";
import type {
  AiAnalysisRepository,
  AiDisclosureSummary,
  AiDisclosureSummaryState,
} from "@/domain/ai-disclosure-summary";
import { DataAccessError } from "@/domain/errors";
import { readVerifiedDisclosureFacts } from "@/domain/ai-disclosure-facts";
import { readServerEnvironment } from "@/server/env";
import { createSupabaseAiAnalysisRepository } from "./supabase-ai-analysis-repository";

export function createAiAnalysisRepository(): AiAnalysisRepository {
  const environment = readServerEnvironment();
  return createSupabaseAiAnalysisRepository({
    supabaseUrl: environment.SUPABASE_URL,
    supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
  });
}

type AiAnalysisRow = Readonly<{
  status: unknown;
  plain_summary: unknown;
  why_it_matters: unknown;
  checkpoints: unknown;
  cautions: unknown;
  ai_importance_score: unknown;
  generated_at: unknown;
  extracted_facts: unknown;
}>;

export async function findAiDisclosureSummaryState(receiptNumber: string): Promise<AiDisclosureSummaryState> {
  const environment = readServerEnvironment();
  const client = createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client
    .from("ai_analyses")
    .select("status,plain_summary,why_it_matters,checkpoints,cautions,extracted_facts,ai_importance_score,generated_at,updated_at,events!inner(source_disclosures!inner(receipt_no))")
    .eq("events.source_disclosures.receipt_no", receiptNumber)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) throw new DataAccessError("AI 요약 상태를 조회하지 못했습니다.");
  const rows = (data ?? []) as unknown as AiAnalysisRow[];
  const published = rows.find((row) => row.status === "SUCCEEDED");
  if (published) return { status: "READY", summary: toPublishedSummary(published) };

  const latestStatus = rows[0]?.status;
  if (latestStatus === "PENDING" || latestStatus === "PROCESSING") {
    return { status: "PENDING", summary: null };
  }
  if (latestStatus === "FAILED") return { status: "FAILED", summary: null };
  return { status: "NOT_GENERATED", summary: null };
}

function toPublishedSummary(row: AiAnalysisRow): AiDisclosureSummary {
  if (typeof row.plain_summary !== "string" || typeof row.generated_at !== "string") {
    throw new DataAccessError("완료된 AI 요약 데이터가 올바르지 않습니다.");
  }
  return {
    plainSummary: row.plain_summary,
    whyItMatters: typeof row.why_it_matters === "string" ? row.why_it_matters : "",
    checkpoints: stringArray(row.checkpoints),
    cautions: stringArray(row.cautions),
    importanceScore: Number(row.ai_importance_score ?? 0),
    generatedAt: row.generated_at,
    verifiedFacts: readVerifiedDisclosureFacts(row.extracted_facts),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

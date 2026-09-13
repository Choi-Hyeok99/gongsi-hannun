import { createSupabaseAiAnalysisRepository } from "@/data/supabase-ai-analysis-repository";
import { analyzePendingDisclosures } from "@/server/ai-disclosure-summary-use-cases";
import { readAiAnalysisEnvironment } from "@/server/ai-env";
import { GeminiDisclosureSummaryClient } from "./gemini-summary-client";

const ANALYSIS_VERSION = "disclosure-summary-v1";

async function main() {
  const environment = readAiAnalysisEnvironment();
  const counts = await analyzePendingDisclosures(
    createSupabaseAiAnalysisRepository({
      supabaseUrl: environment.SUPABASE_URL,
      supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
    }),
    new GeminiDisclosureSummaryClient({ apiKey: environment.GEMINI_API_KEY, model: environment.GEMINI_MODEL }),
    { limit: environment.AI_ANALYSIS_LIMIT, analysisVersion: ANALYSIS_VERSION },
  );
  console.log(`AI 공시 요약 완료: 대상 ${counts.readCount}, 성공 ${counts.succeededCount}, 건너뜀 ${counts.skippedCount}, 실패 ${counts.failedCount}`);
  if (counts.failedCount > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "AI 공시 요약 작업 실패");
  process.exitCode = 1;
});

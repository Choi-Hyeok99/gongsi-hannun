import { createSupabaseAiAnalysisRepository } from "@/data/supabase-ai-analysis-repository";
import { analyzePendingDisclosures } from "@/server/ai-disclosure-summary-use-cases";
import { readAiAnalysisEnvironment } from "@/server/ai-env";
import { GeminiDisclosureSummaryClient } from "./gemini-summary-client";

const ANALYSIS_VERSION = "disclosure-summary-v2-verified-facts";
const GEMINI_INPUT_USD_PER_MILLION_TOKENS = 0.3;
const GEMINI_OUTPUT_USD_PER_MILLION_TOKENS = 2.5;

async function main() {
  const environment = readAiAnalysisEnvironment();
  let inputTokens = 0;
  let outputTokens = 0;
  const client = new GeminiDisclosureSummaryClient({
    apiKey: environment.GEMINI_API_KEY,
    model: environment.GEMINI_MODEL,
    onUsage: (usage) => {
      inputTokens += usage.inputTokens;
      outputTokens += usage.outputTokens;
    },
  });
  await client.assertAvailable();
  console.log(`AI 제공자 사전 점검 완료: google/${client.modelName}`);
  const counts = await analyzePendingDisclosures(
    createSupabaseAiAnalysisRepository({
      supabaseUrl: environment.SUPABASE_URL,
      supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
    }),
    client,
    {
      limit: environment.AI_ANALYSIS_LIMIT,
      analysisVersion: ANALYSIS_VERSION,
      concurrency: 1,
      batchDelayMs: 3_500,
    },
  );
  const estimatedCostUsd = (
    inputTokens * GEMINI_INPUT_USD_PER_MILLION_TOKENS
    + outputTokens * GEMINI_OUTPUT_USD_PER_MILLION_TOKENS
  ) / 1_000_000;
  console.log(`AI 공시 요약 완료: 대상 ${counts.readCount}, 성공 ${counts.succeededCount}, 건너뜀 ${counts.skippedCount}, 실패 ${counts.failedCount}`);
  console.log(`AI 사용량: 입력 ${inputTokens} 토큰, 출력 ${outputTokens} 토큰, 유료 기준 예상 비용 $${estimatedCostUsd.toFixed(6)}`);
  if (counts.failedCount > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "AI 공시 요약 작업 실패");
  process.exitCode = 1;
});

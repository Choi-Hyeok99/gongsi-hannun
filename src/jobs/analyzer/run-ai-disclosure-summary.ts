import { createSupabaseAiAnalysisRepository } from "@/data/supabase-ai-analysis-repository";
import { analyzePendingDisclosures } from "@/server/ai-disclosure-summary-use-cases";
import { readAiAnalysisEnvironment } from "@/server/ai-env";
import { AI_ANALYSIS_VERSION } from "@/domain/ai-analysis-version";
import { GeminiDisclosureSummaryClient } from "./gemini-summary-client";
import { MeasuredGeminiProvider } from "./measured-gemini-provider";
import { createClient } from "@supabase/supabase-js";
import { recordAiUsage } from "@/data/ai-usage-recorder";

const GEMINI_INPUT_USD_PER_MILLION_TOKENS = 0.3;
const GEMINI_OUTPUT_USD_PER_MILLION_TOKENS = 2.5;

async function main() {
  const environment = readAiAnalysisEnvironment();
  let inputTokens = 0;
  let outputTokens = 0;
  const options = {
    apiKey: environment.GEMINI_API_KEY,
    model: environment.GEMINI_MODEL,
    onFailure: ({ code, httpStatus }: {code:string;httpStatus:number}) => console.error(
      `AI 제공자 진단: ${code} (HTTP ${httpStatus})`,
    ),
    onUsage: (usage: {inputTokens:number;outputTokens:number}) => {
      inputTokens += usage.inputTokens;
      outputTokens += usage.outputTokens;
    },
  };
  const client = new GeminiDisclosureSummaryClient(options);
  const metricsClient = createClient(environment.SUPABASE_URL,environment.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const measured = new MeasuredGeminiProvider(options,measurement=>recordAiUsage(metricsClient,measurement));
  await client.assertAvailable();
  console.log(`AI 제공자 사전 점검 완료: google/${client.modelName}`);
  if (process.argv.includes("--probe")) return;
  const counts = await analyzePendingDisclosures(
    createSupabaseAiAnalysisRepository({
      supabaseUrl: environment.SUPABASE_URL,
      supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
      corporateFactsOnly: true,
    }),
    measured,
    {
      limit: environment.AI_ANALYSIS_LIMIT,
      analysisVersion: AI_ANALYSIS_VERSION,
      concurrency: 1,
      batchDelayMs: 10_000,
    },
  );
  const estimatedCostUsd = (
    inputTokens * GEMINI_INPUT_USD_PER_MILLION_TOKENS
    + outputTokens * GEMINI_OUTPUT_USD_PER_MILLION_TOKENS
  ) / 1_000_000;
  console.log(`AI 공시 요약 완료: 대상 ${counts.readCount}, 성공 ${counts.succeededCount}, 건너뜀 ${counts.skippedCount}, 실패 ${counts.failedCount}`);
  if (counts.deferredCount) console.log(`AI 무료 한도 대기: ${counts.deferredCount}건. 다음 한도 초기화 이후 순차 재개하며 유료 API로 전환하지 않습니다.`);
  console.log(`AI 사용량: 입력 ${inputTokens} 토큰, 출력 ${outputTokens} 토큰, 유료 기준 예상 비용 $${estimatedCostUsd.toFixed(6)}`);
  if (counts.failedCount > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "AI 공시 요약 작업 실패");
  process.exitCode = 1;
});

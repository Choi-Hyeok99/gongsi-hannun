import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_USAGE_SOURCE, nonNegativeCount, type AiUsageMeasurement } from "@/domain/admin-metrics";

export async function recordAiUsage(client: SupabaseClient, measurement: AiUsageMeasurement): Promise<void> {
  const {error} = await client.from("ingestion_runs").insert({
    job_type:"AI_ANALYZE",status:measurement.succeeded ? "SUCCEEDED" : "FAILED",
    started_at:measurement.startedAt,finished_at:measurement.finishedAt,
    read_count:1,failed_count:measurement.succeeded ? 0 : 1,
    error_code:measurement.errorCode,
    metadata:{source:AI_USAGE_SOURCE,model:measurement.model,
      inputTokens:nonNegativeCount(measurement.inputTokens),
      outputTokens:nonNegativeCount(measurement.outputTokens),
      totalTokens:nonNegativeCount(measurement.totalTokens)},
  }).abortSignal(AbortSignal.timeout(2500));
  if (error) throw new Error("AI_USAGE_RECORD_UNAVAILABLE");
}

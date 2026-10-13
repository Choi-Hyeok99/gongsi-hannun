import type { AiAnalysisCandidate, AiDisclosureSummaryProvider } from "@/domain/ai-disclosure-summary";
import type { AiUsageMeasurement } from "@/domain/admin-metrics";
import { classifyAnalysisError } from "@/server/ai-disclosure-summary-use-cases";
import { GeminiDisclosureSummaryClient, type AiProviderUsage } from "./gemini-summary-client";

type Options = ConstructorParameters<typeof GeminiDisclosureSummaryClient>[0];
export class MeasuredGeminiProvider implements AiDisclosureSummaryProvider {
  readonly providerName = "google";
  readonly modelName: string;
  constructor(private readonly options: Options, private readonly record: (measurement: AiUsageMeasurement) => Promise<void>) {
    this.modelName = new GeminiDisclosureSummaryClient(options).modelName;
  }
  async summarize(candidate: AiAnalysisCandidate) {
    const startedAt = new Date().toISOString();
    let usage: AiProviderUsage | null = null;
    let succeeded = false;
    let errorCode: string | null = null;
    // Each call has its own usage holder, including concurrent batch calls.
    const client = new GeminiDisclosureSummaryClient({...this.options, onUsage:value => {
      usage = value;
      this.options.onUsage?.(value);
    }});
    try {
      const result = await client.summarize(candidate);
      succeeded = true;
      return result;
    } catch (error) {
      errorCode = classifyAnalysisError(error);
      throw error;
    } finally {
      const measured = usage as AiProviderUsage | null;
      // Monitoring failure must never turn a successful summary into a failure.
      try {
        await this.record({model:this.modelName,succeeded,errorCode,
          inputTokens:measured?.inputTokens ?? null,outputTokens:measured?.outputTokens ?? null,
          totalTokens:measured?.totalTokens ?? null,startedAt,finishedAt:new Date().toISOString()});
      } catch { console.warn("AI_USAGE_RECORD_UNAVAILABLE"); }
    }
  }
}

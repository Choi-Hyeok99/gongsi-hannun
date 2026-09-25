import type {
  AiAnalysisCandidate,
  AiDisclosureSummaryProvider,
  GeneratedAiDisclosureSummaryCandidate,
} from "@/domain/ai-disclosure-summary";
import { verifyDisclosureFactCandidates } from "@/domain/ai-disclosure-facts";
import type { AiProviderUsage } from "@/jobs/analyzer/gemini-summary-client";

export type ComparisonProvider = Readonly<{
  client: AiDisclosureSummaryProvider;
  getUsage: () => AiProviderUsage | null;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}>;

export type ProviderComparisonResult = Readonly<{
  provider: string;
  model: string;
  status: "SUCCEEDED" | "FAILED";
  latencyMs: number;
  usage: AiProviderUsage | null;
  estimatedCostUsd: number | null;
  verifiedFactCount: number;
  summary: GeneratedAiDisclosureSummaryCandidate | null;
  errorCode: string | null;
}>;

export type CandidateComparisonResult = Readonly<{
  receiptNumber: string;
  companyName: string;
  reportName: string;
  disclosedOn: string;
  providers: readonly ProviderComparisonResult[];
}>;

export async function compareCandidate(
  candidate: AiAnalysisCandidate,
  providers: readonly ComparisonProvider[],
): Promise<CandidateComparisonResult> {
  const results = await Promise.all(providers.map(async (provider): Promise<ProviderComparisonResult> => {
    const startedAt = performance.now();
    try {
      const summary = await provider.client.summarize(candidate);
      const usage = provider.getUsage();
      return {
        provider: provider.client.providerName,
        model: provider.client.modelName,
        status: "SUCCEEDED",
        latencyMs: Math.round(performance.now() - startedAt),
        usage,
        estimatedCostUsd: usage ? estimateCost(usage, provider) : null,
        verifiedFactCount: verifyDisclosureFactCandidates(candidate, summary.factCandidates).length,
        summary,
        errorCode: null,
      };
    } catch (error) {
      return {
        provider: provider.client.providerName,
        model: provider.client.modelName,
        status: "FAILED",
        latencyMs: Math.round(performance.now() - startedAt),
        usage: provider.getUsage(),
        estimatedCostUsd: null,
        verifiedFactCount: 0,
        summary: null,
        errorCode: safeErrorCode(error),
      };
    }
  }));

  return {
    receiptNumber: candidate.receiptNumber,
    companyName: candidate.companyName,
    reportName: candidate.reportName,
    disclosedOn: candidate.disclosedOn,
    providers: results,
  };
}

function estimateCost(usage: AiProviderUsage, provider: ComparisonProvider): number {
  return (usage.inputTokens * provider.inputUsdPerMillion + usage.outputTokens * provider.outputUsdPerMillion) / 1_000_000;
}

function safeErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "AI_UNKNOWN_ERROR";
  return /^AI_[A-Z_]+$/.test(error.message) ? error.message : error.name === "AbortError" ? "AI_TIMEOUT" : "AI_UNKNOWN_ERROR";
}

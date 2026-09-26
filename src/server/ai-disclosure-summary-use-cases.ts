import type {
  AiAnalysisCounts,
  AiAnalysisRepository,
  AiDisclosureSummary,
  AiDisclosureSummaryProvider,
} from "@/domain/ai-disclosure-summary";
import { verifyDisclosureFactCandidates } from "@/domain/ai-disclosure-facts";

export async function getPublishedAiSummary(repository: AiAnalysisRepository, receiptNumber: string): Promise<AiDisclosureSummary | null> {
  return repository.findPublishedByReceiptNumber(receiptNumber);
}

export async function analyzePendingDisclosures(
  repository: AiAnalysisRepository,
  provider: AiDisclosureSummaryProvider,
  options: Readonly<{ limit: number; analysisVersion: string; concurrency?: number }>,
): Promise<AiAnalysisCounts> {
  const candidates = await repository.findCandidates(options.limit, options.analysisVersion);
  let succeededCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const concurrency = Math.max(1, Math.min(5, Math.trunc(options.concurrency ?? 3)));

  for (let index = 0; index < candidates.length; index += concurrency) {
    await Promise.all(candidates.slice(index, index + concurrency).map(async (candidate) => {
      const started = await repository.begin(candidate, options.analysisVersion);
      if (!started) {
        skippedCount += 1;
        return;
      }
      try {
        const generated = await provider.summarize(candidate);
        const summary = {
          plainSummary: generated.plainSummary,
          whyItMatters: generated.whyItMatters,
          checkpoints: generated.checkpoints,
          cautions: generated.cautions,
          importanceScore: generated.importanceScore,
          verifiedFacts: verifyDisclosureFactCandidates(candidate, generated.factCandidates),
        };
        await repository.complete(candidate.eventId, options.analysisVersion, provider, summary);
        succeededCount += 1;
      } catch (error) {
        await repository.fail(candidate.eventId, options.analysisVersion, classifyAnalysisError(error));
        failedCount += 1;
      }
    }));
  }

  return { readCount: candidates.length, succeededCount, skippedCount, failedCount };
}

function classifyAnalysisError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return "AI_TIMEOUT";
  if (error instanceof Error && SAFE_ANALYSIS_ERROR_CODES.has(error.message)) return error.message;
  return "AI_UPSTREAM_ERROR";
}

const SAFE_ANALYSIS_ERROR_CODES = new Set([
  "AI_INVALID_RESPONSE",
  "AI_INVALID_REQUEST",
  "AI_AUTH_ERROR",
  "AI_MODEL_NOT_FOUND",
  "AI_TIMEOUT",
  "AI_RATE_LIMITED",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_UPSTREAM_ERROR",
]);

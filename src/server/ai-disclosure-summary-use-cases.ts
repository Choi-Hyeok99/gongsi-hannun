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
  options: Readonly<{ limit: number; analysisVersion: string; concurrency?: number; batchDelayMs?: number }>,
): Promise<AiAnalysisCounts> {
  const candidates = await repository.findCandidates(options.limit, options.analysisVersion);
  let succeededCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const concurrency = Math.max(1, Math.min(5, Math.trunc(options.concurrency ?? 3)));
  const batchDelayMs = Math.max(0, Math.min(10_000, Math.trunc(options.batchDelayMs ?? 0)));
  let providerBlocked = false;

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
        const code = classifyAnalysisError(error);
        await repository.fail(candidate.eventId, options.analysisVersion, code);
        if (["AI_AUTH_ERROR", "AI_MODEL_NOT_FOUND", "AI_INVALID_REQUEST", "AI_BILLING_REQUIRED", "AI_RATE_LIMITED", "AI_PROVIDER_UNAVAILABLE"].includes(code)) providerBlocked = true;
        failedCount += 1;
      }
    }));
    if (providerBlocked) {
      skippedCount += candidates.length - Math.min(candidates.length, index + concurrency);
      break;
    }
    if (batchDelayMs > 0 && index + concurrency < candidates.length) {
      await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
    }
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
  "AI_NO_SAFE_INPUT",
  "AI_INVALID_REQUEST",
  "AI_AUTH_ERROR",
  "AI_BILLING_REQUIRED",
  "AI_MODEL_NOT_FOUND",
  "AI_TIMEOUT",
  "AI_RATE_LIMITED",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_UPSTREAM_ERROR",
]);

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
  options: Readonly<{ limit: number; analysisVersion: string }>,
): Promise<AiAnalysisCounts> {
  const candidates = await repository.findCandidates(options.limit, options.analysisVersion);
  let succeededCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    const started = await repository.begin(candidate, options.analysisVersion);
    if (!started) {
      skippedCount += 1;
      continue;
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
  }

  return { readCount: candidates.length, succeededCount, skippedCount, failedCount };
}

function classifyAnalysisError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return "AI_TIMEOUT";
  if (error instanceof Error && error.message === "AI_INVALID_RESPONSE") return "AI_INVALID_RESPONSE";
  return "AI_UPSTREAM_ERROR";
}

import type { AiAnalysisCandidate, AiAnalysisRepository, AiDisclosureSummaryProvider } from "@/domain/ai-disclosure-summary";
import { AI_ANALYSIS_VERSION } from "@/domain/ai-analysis-version";
import { corporateAiInput } from "@/domain/corporate-ai-input";
import { verifyDisclosureFactCandidates } from "@/domain/ai-disclosure-facts";
import { classifyAnalysisError } from "@/server/ai-disclosure-summary-use-cases";

export type OnDemandAiResult = Readonly<{
  status: "READY" | "WAITING" | "RETRYING" | "RATE_LIMIT" | "SOURCE_UNAVAILABLE" | "DELAYED" | "UNAVAILABLE";
  retryAfterSeconds?: number;
}>;
export interface OnDemandAiRepository extends AiAnalysisRepository {
  findCandidateByReceiptNumber(receipt: string, version: string): Promise<AiAnalysisCandidate | null>;
}
export interface OnDemandAiGuard {
  acquire(): Promise<{status:"ACQUIRED";token:string} | {status:"BUSY";retryAfterSeconds:number} | {status:"RATE_LIMIT"} | {status:"UNAVAILABLE"}>;
  release(token: string, errorCode?: string): Promise<void>;
}

export async function generateVisitedDisclosureSummary(
  receiptNumber: string,
  repository: OnDemandAiRepository,
  provider: AiDisclosureSummaryProvider,
  guard: OnDemandAiGuard,
): Promise<OnDemandAiResult> {
  if (await repository.findPublishedByReceiptNumber(receiptNumber)) return {status:"READY"};
  const candidate = await repository.findCandidateByReceiptNumber(receiptNumber, AI_ANALYSIS_VERSION);
  if (!candidate || !corporateAiInput(candidate)) return {status:"SOURCE_UNAVAILABLE"};
  const slot = await guard.acquire();
  if (slot.status === "RATE_LIMIT") return {status:"RATE_LIMIT"};
  if (slot.status === "UNAVAILABLE") return {status:"UNAVAILABLE"};
  if (slot.status === "BUSY") return {status:"WAITING",retryAfterSeconds:slot.retryAfterSeconds};
  let failure: string | undefined;
  try {
    // Recheck after acquiring the shared slot: a batch job may have completed meanwhile.
    if (await repository.findPublishedByReceiptNumber(receiptNumber)) return {status:"READY"};
    if (!await repository.begin(candidate, AI_ANALYSIS_VERSION)) return {status:"WAITING",retryAfterSeconds:10};
    try {
      const generated = await provider.summarize(candidate);
      await repository.complete(candidate.eventId, AI_ANALYSIS_VERSION, provider, {
        plainSummary: generated.plainSummary,
        whyItMatters: generated.whyItMatters,
        checkpoints: generated.checkpoints,
        cautions: generated.cautions,
        importanceScore: generated.importanceScore,
        verifiedFacts: verifyDisclosureFactCandidates(candidate, generated.factCandidates),
      });
      return {status:"READY"};
    } catch (error) {
      failure = classifyAnalysisError(error);
      await repository.fail(candidate.eventId, AI_ANALYSIS_VERSION, failure);
      if (failure === "AI_PROVIDER_UNAVAILABLE" && await repository.findCandidateByReceiptNumber(receiptNumber, AI_ANALYSIS_VERSION)) {
        return {status:"RETRYING",retryAfterSeconds:60};
      }
      return {status:failure === "AI_RATE_LIMITED" ? "RATE_LIMIT" : "DELAYED"};
    }
  } finally {
    await guard.release(slot.token, failure);
  }
}

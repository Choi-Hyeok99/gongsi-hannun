import type { DisclosureEventType } from "@/domain/disclosure-classification";
import type {
  DisclosureFactCandidate,
  DisclosureFactSourceDocument,
  VerifiedDisclosureFact,
} from "@/domain/ai-disclosure-facts";

export type AiDisclosureSummary = Readonly<{
  plainSummary: string;
  whyItMatters: string;
  checkpoints: readonly string[];
  cautions: readonly string[];
  importanceScore: number;
  generatedAt: string;
  verifiedFacts: readonly VerifiedDisclosureFact[];
}>;

export type AiDisclosureSummaryState =
  | Readonly<{ status: "NOT_GENERATED" | "PENDING" | "FAILED"; summary: null }>
  | Readonly<{ status: "READY"; summary: AiDisclosureSummary }>;

export type AiAnalysisCandidate = Readonly<{
  eventId: string;
  receiptNumber: string;
  companyName: string;
  reportName: string;
  disclosedOn: string;
  eventType: DisclosureEventType;
  ruleImportanceScore: number;
  contentText: string;
  inputHash: string;
  sourceDocument: DisclosureFactSourceDocument;
}>;

export type GeneratedAiDisclosureSummary = Omit<AiDisclosureSummary, "generatedAt">;

export type GeneratedAiDisclosureSummaryCandidate = Omit<GeneratedAiDisclosureSummary, "verifiedFacts"> & Readonly<{
  factCandidates: readonly DisclosureFactCandidate[];
}>;

export interface AiDisclosureSummaryProvider {
  readonly providerName: string;
  readonly modelName: string;
  summarize(candidate: AiAnalysisCandidate): Promise<GeneratedAiDisclosureSummaryCandidate>;
}

export interface AiAnalysisRepository {
  findCandidates(limit: number, analysisVersion: string): Promise<readonly AiAnalysisCandidate[]>;
  begin(candidate: AiAnalysisCandidate, analysisVersion: string): Promise<boolean>;
  complete(eventId: string, analysisVersion: string, provider: AiDisclosureSummaryProvider, summary: GeneratedAiDisclosureSummary): Promise<void>;
  fail(eventId: string, analysisVersion: string, errorCode: string): Promise<void>;
  findPublishedByReceiptNumber(receiptNumber: string): Promise<AiDisclosureSummary | null>;
}

export type AiAnalysisCounts = Readonly<{
  readCount: number;
  succeededCount: number;
  skippedCount: number;
  failedCount: number;
}>;

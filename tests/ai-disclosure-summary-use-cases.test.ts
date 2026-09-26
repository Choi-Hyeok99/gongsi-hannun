import { describe, expect, it, vi } from "vitest";
import type { AiAnalysisRepository, AiDisclosureSummaryProvider } from "@/domain/ai-disclosure-summary";
import { analyzePendingDisclosures } from "@/server/ai-disclosure-summary-use-cases";

const candidate = {
  eventId: "event-1", receiptNumber: "1", companyName: "기업", reportName: "보고서", disclosedOn: "2026-09-11",
  eventType: "MATERIAL_DISCLOSURE" as const, ruleImportanceScore: 70, contentText: "본문", inputHash: "a".repeat(64),
  sourceDocument: { id: "document-1", title: "주요 문서", kind: "MAIN" as const, contentHash: "b".repeat(64) },
};
const summary = { plainSummary: "충분히 긴 핵심 요약입니다.", whyItMatters: "투자자가 확인할 중요한 이유입니다.", checkpoints: ["핵심 수치 확인"], cautions: ["원문 확인"], importanceScore: 70, factCandidates: [] };

function repository(overrides: Partial<AiAnalysisRepository> = {}): AiAnalysisRepository {
  return {
    findCandidates: vi.fn(async () => [candidate]), begin: vi.fn(async () => true), complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined), findPublishedByReceiptNumber: vi.fn(async () => null), ...overrides,
  };
}

describe("analyzePendingDisclosures", () => {
  it("stores a successful structured summary", async () => {
    const repo = repository();
    const provider: AiDisclosureSummaryProvider = { providerName: "google", modelName: "gemini-2.5-flash-lite", summarize: vi.fn(async () => summary) };
    await expect(analyzePendingDisclosures(repo, provider, { limit: 1, analysisVersion: "v1" })).resolves.toEqual({ readCount: 1, succeededCount: 1, skippedCount: 0, failedCount: 0 });
    expect(repo.complete).toHaveBeenCalledWith("event-1", "v1", provider, {
      plainSummary: summary.plainSummary,
      whyItMatters: summary.whyItMatters,
      checkpoints: summary.checkpoints,
      cautions: summary.cautions,
      importanceScore: summary.importanceScore,
      verifiedFacts: [],
    });
  });

  it("stores only a safe error code when the provider fails", async () => {
    const repo = repository();
    const provider: AiDisclosureSummaryProvider = { providerName: "google", modelName: "gemini-2.5-flash-lite", summarize: vi.fn(async () => { throw new Error("credential=do-not-store"); }) };
    await expect(analyzePendingDisclosures(repo, provider, { limit: 1, analysisVersion: "v1" })).resolves.toMatchObject({ failedCount: 1 });
    expect(repo.fail).toHaveBeenCalledWith("event-1", "v1", "AI_UPSTREAM_ERROR");
  });

  it("preserves a safe provider diagnostic code", async () => {
    const repo = repository();
    const provider: AiDisclosureSummaryProvider = { providerName: "google", modelName: "gemini", summarize: vi.fn(async () => { throw new Error("AI_RATE_LIMITED"); }) };
    await analyzePendingDisclosures(repo, provider, { limit: 1, analysisVersion: "v1" });
    expect(repo.fail).toHaveBeenCalledWith("event-1", "v1", "AI_RATE_LIMITED");
  });

  it("processes a large batch concurrently without exceeding the safety cap", async () => {
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      ...candidate,
      eventId: `event-${index + 1}`,
      receiptNumber: String(index + 1),
    }));
    const repo = repository({ findCandidates: vi.fn(async () => candidates) });
    let active = 0;
    let maximumActive = 0;
    const provider: AiDisclosureSummaryProvider = {
      providerName: "google",
      modelName: "gemini",
      summarize: vi.fn(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return summary;
      }),
    };

    await expect(analyzePendingDisclosures(repo, provider, {
      limit: 8,
      analysisVersion: "v1",
      concurrency: 20,
    })).resolves.toEqual({ readCount: 8, succeededCount: 8, skippedCount: 0, failedCount: 0 });
    expect(maximumActive).toBe(5);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { AiAnalysisCandidate, AiDisclosureSummaryProvider } from "@/domain/ai-disclosure-summary";
import { compareCandidate, type ComparisonProvider } from "@/server/ai-provider-comparison";

const candidate: AiAnalysisCandidate = {
  eventId: "event-1",
  receiptNumber: "20260911000001",
  companyName: "테스트기업",
  reportName: "공급계약 체결",
  disclosedOn: "2026-09-11",
  eventType: "MATERIAL_DISCLOSURE",
  ruleImportanceScore: 90,
  contentText: "계약금액은 100억원입니다.",
  inputHash: "a".repeat(64),
  sourceDocument: { id: "document-1", title: "주요 문서", kind: "MAIN", contentHash: "b".repeat(64) },
};

const summary = {
  plainSummary: "회사가 공급 계약을 체결했다고 공시했습니다.",
  whyItMatters: "향후 매출에 반영될 계약 내용을 확인할 수 있습니다.",
  checkpoints: ["계약 상대방을 확인하세요."],
  cautions: ["계약 변경 가능성을 확인하세요."],
  importanceScore: 90,
  factCandidates: [{ kind: "AMOUNT" as const, label: "계약금액", value: "100", unit: "억원", sourceQuote: "계약금액은 100억원" }],
};

function provider(name: string, result: "success" | "failure"): ComparisonProvider {
  const client: AiDisclosureSummaryProvider = {
    providerName: name,
    modelName: `${name}-model`,
    summarize: result === "success" ? vi.fn(async () => summary) : vi.fn(async () => { throw new Error("AI_RATE_LIMITED"); }),
  };
  return {
    client,
    getUsage: () => result === "success" ? { inputTokens: 1_000, outputTokens: 100, totalTokens: 1_100 } : null,
    inputUsdPerMillion: 1,
    outputUsdPerMillion: 2,
  };
}

describe("compareCandidate", () => {
  it("records costs and only counts facts verified against the source", async () => {
    const result = await compareCandidate(candidate, [provider("first", "success"), provider("second", "success")]);
    expect(result.providers).toHaveLength(2);
    expect(result.providers[0]).toMatchObject({ status: "SUCCEEDED", verifiedFactCount: 1, estimatedCostUsd: 0.0012 });
  });

  it("keeps safe provider failure codes without failing the other model", async () => {
    const result = await compareCandidate(candidate, [provider("first", "success"), provider("second", "failure")]);
    expect(result.providers[0]?.status).toBe("SUCCEEDED");
    expect(result.providers[1]).toMatchObject({ status: "FAILED", errorCode: "AI_RATE_LIMITED", summary: null });
  });
});

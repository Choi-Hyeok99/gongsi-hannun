import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  data: [] as unknown[],
  error: null as null | { message: string },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/env", () => ({
  readServerEnvironment: () => ({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "secret" }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: async () => ({ data: database.data, error: database.error }),
      };
      return query;
    },
  }),
}));

import { findAiDisclosureSummaryState } from "@/data/server-ai-analysis-repository";

describe("findAiDisclosureSummaryState", () => {
  beforeEach(() => {
    database.data = [];
    database.error = null;
  });

  it("returns NOT_GENERATED when no analysis row exists", async () => {
    await expect(findAiDisclosureSummaryState("202609140001"))
      .resolves.toEqual({ status: "NOT_GENERATED", summary: null });
  });

  it.each(["PENDING", "PROCESSING"] as const)("preserves the factual %s display state and timestamp", async (status) => {
    database.data = [{ status, updated_at: "2026-09-14T03:20:00Z" }];
    await expect(findAiDisclosureSummaryState("202609140001"))
      .resolves.toEqual({ status, summary: null, updatedAt: "2026-09-14T03:20:00Z" });
  });

  it("returns the failed display state when generation failed", async () => {
    database.data = [{ status: "FAILED", updated_at: "2026-09-14T04:20:00Z" }];
    await expect(findAiDisclosureSummaryState("202609140001"))
      .resolves.toEqual({ status: "FAILED", summary: null, updatedAt: "2026-09-14T04:20:00Z" });
  });

  it("returns only stored fields from a successful analysis", async () => {
    database.data = [{
      status: "SUCCEEDED",
      plain_summary: "실제 요약",
      why_it_matters: "실제 중요 이유",
      checkpoints: ["확인 항목"],
      cautions: ["주의 항목"],
      ai_importance_score: 82,
      generated_at: "2026-09-14T00:00:00Z",
    }];

    await expect(findAiDisclosureSummaryState("202609140001")).resolves.toEqual({
      status: "READY",
      summary: {
        plainSummary: "실제 요약",
        whyItMatters: "실제 중요 이유",
        checkpoints: ["확인 항목"],
        cautions: ["주의 항목"],
        importanceScore: 82,
        generatedAt: "2026-09-14T00:00:00Z",
        verifiedFacts: [],
      },
    });
  });

  it("keeps the latest published summary available when a newer attempt failed", async () => {
    database.data = [
      { status: "FAILED" },
      { status: "SUCCEEDED", plain_summary: "검증된 기존 요약", generated_at: "2026-09-13T00:00:00Z" },
    ];
    await expect(findAiDisclosureSummaryState("202609140001"))
      .resolves.toMatchObject({ status: "READY", summary: { plainSummary: "검증된 기존 요약" } });
  });

  it("does not turn a database error into an analysis result", async () => {
    database.error = { message: "unavailable" };
    await expect(findAiDisclosureSummaryState("202609140001"))
      .rejects.toThrow("AI 요약 상태를 조회하지 못했습니다.");
  });
});

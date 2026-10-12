import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/daily-collection.yml", "utf8");

describe("daily market data workflow", () => {
  it("runs analysis independently after failed or skipped source collection", () => {
    const summaryJob = workflow.slice(workflow.indexOf("  summarize:"));
    expect(summaryJob).toContain("needs: collect");
    expect(summaryJob).toContain("if: always() && !cancelled()");
    expect(summaryJob).toContain("run-ai-disclosure-summary.ts --probe");
    expect(summaryJob).toContain("inputs.mode == 'ai_only' && inputs.analysis_limit");
    expect(summaryJob).not.toContain("continue-on-error: true");
    expect(workflow).toMatch(/name: Collect OpenDART filing documents\r?\n\s+continue-on-error: true/);
  });
  it("runs after the preliminary and final Korean market close transmissions", () => {
    expect(workflow).toContain('cron: "10 7 * * 1-5"');
    expect(workflow).toContain('cron: "20 9 * * 1-5"');
    expect(workflow).toContain('timeZone: "Asia/Seoul"');
  });

  it("re-collects a seven-day KRX window to repair missed runs", () => {
    expect(workflow).toContain("priceLookback.getUTCDate() - 7");
    expect(workflow).toContain("`price_from=${priceFrom}`");
    expect(workflow).toContain('--from "${{ steps.dates.outputs.price_from }}"');
    expect(workflow).toContain('--to "${{ steps.dates.outputs.collection_date }}"');
  });

  it("keeps secrets in the Actions secret store", () => {
    expect(workflow).toContain("KRX_API_KEY: ${{ secrets.KRX_API_KEY }}");
    expect(workflow).toContain("SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}");
  });
});

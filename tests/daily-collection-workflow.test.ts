import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/daily-collection.yml", "utf8");

describe("daily market data workflow", () => {
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
    expect(workflow).toContain("WEB_PUSH_VAPID_PRIVATE_KEY: ${{ secrets.WEB_PUSH_VAPID_PRIVATE_KEY }}");
  });

  it("runs bounded AI analysis only after the final market collection", () => {
    expect(workflow).toContain("github.event.schedule == '20 9 * * 1-5'");
    expect(workflow).toContain('AI_ANALYSIS_LIMIT: "10"');
  });

  it("keeps KRX collection running when OpenDART is unavailable and reports source failures", () => {
    expect(workflow.indexOf("run-daily-price-sync.ts")).toBeLessThan(workflow.indexOf("run-disclosure-sync.ts"));
    expect(workflow).toContain("steps.prices.outcome == 'failure' || steps.disclosures.outcome == 'failure'");
    expect(workflow).toMatch(/id: disclosures\r?\n\s+continue-on-error: true/);
  });
});

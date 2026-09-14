import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/company-industry-sync.yml", "utf8");

describe("company industry sync workflow", () => {
  it("runs a bounded weekday batch with explicit secrets", () => {
    expect(workflow).toContain('cron: "15 19 * * 0-4"');
    expect(workflow).toContain("COMPANY_INDUSTRY_SYNC_LIMIT: ${{ inputs.limit || '250' }}");
    expect(workflow).toContain("COMPANY_INDUSTRY_SYNC_DELAY_MS: \"150\"");
    expect(workflow).toContain("OPENDART_API_KEY: ${{ secrets.OPENDART_API_KEY }}");
    expect(workflow).toContain("run-company-industry-sync.ts");
    expect(workflow).toContain("verify-company-data-completeness.ts");
  });

  it("does not request an unbounded full-company run", () => {
    expect(workflow).not.toContain("sync:companies");
    expect(workflow).not.toContain("COMPANY_INDUSTRY_SYNC_LIMIT: \"3931\"");
  });
});

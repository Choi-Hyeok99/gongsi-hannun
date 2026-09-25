import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/near-realtime-disclosures.yml", "utf8");

describe("near real-time disclosure workflow", () => {
  it("polls every ten minutes during weekday KST service hours", () => {
    expect(workflow).toContain('cron: "*/10 23 * * 0-4"');
    expect(workflow).toContain('cron: "*/10 0-11 * * 1-5"');
    expect(workflow).toContain("timeZone: \"Asia/Seoul\"");
  });

  it("runs the idempotent disclosure pipeline without collecting stock prices", () => {
    const disclosure = workflow.indexOf("run-disclosure-sync.ts");
    const event = workflow.indexOf("run-event-materialization.ts");
    const alert = workflow.indexOf("run-disclosure-alert-generation.ts");
    const push = workflow.indexOf("run-web-push-delivery.ts");
    const document = workflow.indexOf("run-disclosure-document-sync.ts");

    expect(disclosure).toBeGreaterThan(-1);
    expect(disclosure).toBeLessThan(event);
    expect(event).toBeLessThan(alert);
    expect(alert).toBeLessThan(push);
    expect(push).toBeLessThan(document);
    expect(workflow).not.toContain("run-ai-disclosure-summary.ts");
    expect(workflow).not.toContain("run-daily-price-sync.ts");
  });

  it("caps expensive work and keeps optional enrichment from blocking collection", () => {
    expect(workflow).toContain('DISCLOSURE_DOCUMENT_SYNC_LIMIT: "20"');
    expect(workflow.match(/continue-on-error: true/g)).toHaveLength(2);
    expect(workflow).toContain("WEB_PUSH_VAPID_PRIVATE_KEY: ${{ secrets.WEB_PUSH_VAPID_PRIVATE_KEY }}");
  });
});

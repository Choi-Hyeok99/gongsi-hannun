import { describe, expect, it } from "vitest";
import { latestCompletedKoreaWeekday } from "@/jobs/collector/verify-live-data-readiness";

describe("latestCompletedKoreaWeekday", () => {
  it("uses the prior weekday before the final KRX publication window", () => {
    expect(latestCompletedKoreaWeekday(new Date("2026-09-14T07:00:00.000Z"))).toBe("2026-09-11");
  });

  it("uses the same weekday after the final publication window", () => {
    expect(latestCompletedKoreaWeekday(new Date("2026-09-14T10:30:00.000Z"))).toBe("2026-09-14");
  });
});

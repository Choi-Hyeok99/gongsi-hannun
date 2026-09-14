import { describe, expect, it } from "vitest";
import {
  latestCompletedKoreaWeekday,
  liveDataSchemaChecks,
} from "@/jobs/collector/verify-live-data-readiness";

describe("liveDataSchemaChecks", () => {
  it("checks the canonical persisted column names", () => {
    expect(liveDataSchemaChecks).toEqual(expect.arrayContaining([
      {
        table: "companies",
        columns: "id,stock_code,market,industry_category,industry_profile_synced_at",
      },
      {
        table: "ingestion_runs",
        columns: "id,job_type,status,range_start,range_end,error_code",
      },
      {
        table: "source_disclosures",
        columns: "id,receipt_no,content_fetch_status,received_at",
      },
      {
        table: "watchlist_alert_settings",
        columns: "user_id,company_id,minimum_importance_score",
      },
    ]));
  });
});

describe("latestCompletedKoreaWeekday", () => {
  it("uses the prior weekday before the final KRX publication window", () => {
    expect(latestCompletedKoreaWeekday(new Date("2026-09-14T07:00:00.000Z"))).toBe("2026-09-11");
  });

  it("uses the same weekday after the final publication window", () => {
    expect(latestCompletedKoreaWeekday(new Date("2026-09-14T10:30:00.000Z"))).toBe("2026-09-14");
  });
});

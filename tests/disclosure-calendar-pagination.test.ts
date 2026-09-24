import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseDisclosureRepository } from "@/data/supabase-disclosure-repository";

vi.mock("server-only", () => ({}));

describe("Supabase disclosure calendar", () => {
  it("reads later dates after the first full page instead of reporting zero", async () => {
    const rows = Array.from({ length: 301 }, (_, index) => ({
      receipt_no: String(index + 1).padStart(14, "0"),
      report_name: "주요 공시",
      filer_name: null,
      disclosed_on: index < 300 ? "2026-09-01" : "2026-09-23",
      original_url: "https://dart.fss.or.kr/",
      disclosure_status: "ACTIVE",
      companies: { stock_code: "005930", name_ko: "삼성전자", market: "KOSPI" },
      events: { event_type: "SUPPLY_CONTRACT", visibility: "PUBLIC" },
    }));
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn(async (start: number, end: number) => ({ data: rows.slice(start, end + 1), error: null })),
    };
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient;

    const items = await new SupabaseDisclosureRepository(client).findByDateRange("2026-09-01", "2026-09-30", 300);

    expect(items).toHaveLength(301);
    expect(items.at(-1)?.disclosedOn).toBe("2026-09-23");
    expect(query.range).toHaveBeenNthCalledWith(1, 0, 299);
    expect(query.range).toHaveBeenNthCalledWith(2, 300, 599);
  });
});

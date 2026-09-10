import { describe, expect, it, vi } from "vitest";
import { ExternalServiceError } from "@/domain/errors";
import { OpenDartClient } from "@/jobs/collector/open-dart-client";

const query = { fromDate: "20260909", toDate: "20260909", page: 1 };

describe("OpenDartClient", () => {
  it("maps a validated disclosure without exposing the API key", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: "000", message: "정상", page_no: 1, total_count: 1, total_page: 1, list: [{ corp_cls: "Y", corp_code: "00126380", corp_name: "삼성전자", stock_code: "005930", flr_nm: "삼성전자", report_nm: "주요사항보고서       (정정)", rcept_no: "20260909000001", rcept_dt: "20260909", rm: "" }] }), { status: 200 }));
    const client = new OpenDartClient({ apiKey: "secret-key", fetcher });
    const result = await client.listDisclosures(query);
    expect(result[0]).toMatchObject({ stockCode: "005930", disclosedOn: "2026-09-09", reportName: "주요사항보고서 (정정)" });
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });

  it("returns validated pagination metadata", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response(JSON.stringify({
        status: "000",
        message: "정상",
        page_no: 2,
        total_count: 101,
        total_page: 2,
        list: [],
      }), { status: 200 });
    });
    await expect(new OpenDartClient({ apiKey: "secret-key", fetcher }).fetchPage({
      ...query,
      page: 2,
      corpClass: "K",
    })).resolves.toMatchObject({ page: 2, totalCount: 101, totalPages: 2 });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("corp_cls=K");
  });

  it("returns an empty list for the official no-data status", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: "013", message: "조회된 데이터가 없습니다." }), { status: 200 }));
    await expect(new OpenDartClient({ apiKey: "secret-key", fetcher }).listDisclosures(query)).resolves.toEqual([]);
  });

  it("rejects malformed responses", async () => {
    const fetcher = vi.fn(async () => new Response("not-json", { status: 200 }));
    await expect(new OpenDartClient({ apiKey: "secret-key", fetcher }).listDisclosures(query)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("classifies rate limits", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 429 }));
    await expect(new OpenDartClient({ apiKey: "secret-key", fetcher }).listDisclosures(query)).rejects.toEqual(expect.objectContaining<Partial<ExternalServiceError>>({ code: "RATE_LIMITED" }));
  });
});

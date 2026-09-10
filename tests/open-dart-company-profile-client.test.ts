import { describe, expect, it, vi } from "vitest";
import { OpenDartCompanyProfileClient } from "@/jobs/collector/open-dart-company-profile-client";

describe("OpenDartCompanyProfileClient", () => {
  it("maps official industry and market fields", async () => {
    let requestedUrl: URL | undefined;
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      requestedUrl = new URL(String(input));
      return new Response(JSON.stringify({
        status: "000",
        message: "정상",
        corp_cls: "Y",
        induty_code: "264",
      }));
    });
    const client = new OpenDartCompanyProfileClient({ apiKey: "x".repeat(40), fetcher });

    await expect(client.fetchProfile("00126380")).resolves.toEqual({
      dartCorpCode: "00126380",
      industryCode: "264",
      market: "KOSPI",
    });
    expect(requestedUrl?.searchParams.get("corp_code")).toBe("00126380");
  });

  it("treats an official no-data response as a completed empty profile", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: "013", message: "조회된 데이터가 없습니다." })));
    const client = new OpenDartCompanyProfileClient({ apiKey: "x".repeat(40), fetcher });
    await expect(client.fetchProfile("00000001")).resolves.toBeNull();
  });

  it("maps the official request-limit response", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: "020", message: "요청 제한" })));
    const client = new OpenDartCompanyProfileClient({ apiKey: "x".repeat(40), fetcher });
    await expect(client.fetchProfile("00126380")).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("rejects oversized responses", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { headers: { "content-length": "101" } }));
    const client = new OpenDartCompanyProfileClient({ apiKey: "x".repeat(40), fetcher, maxResponseBytes: 100 });
    await expect(client.fetchProfile("00126380")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});

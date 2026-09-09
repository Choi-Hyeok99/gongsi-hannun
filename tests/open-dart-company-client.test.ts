import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { OpenDartCompanyClient } from "@/jobs/collector/open-dart-company-client";

const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<result>
  <list>
    <corp_code>00126380</corp_code>
    <corp_name>삼성전자</corp_name>
    <corp_eng_name>Samsung Electronics</corp_eng_name>
    <stock_code>005930</stock_code>
    <modify_date>20260909</modify_date>
  </list>
  <list>
    <corp_code>00000001</corp_code>
    <corp_name>비상장회사</corp_name>
    <corp_eng_name></corp_eng_name>
    <stock_code></stock_code>
    <modify_date>20260908</modify_date>
  </list>
</result>`;

describe("OpenDartCompanyClient", () => {
  it("keeps leading zeroes and maps listed and unlisted companies", async () => {
    const archive = zipSync({ "CORPCODE.xml": strToU8(validXml) });
    const fetcher = vi.fn(async () => new Response(archive, { status: 200 }));
    const result = await new OpenDartCompanyClient({ apiKey: "x".repeat(40), fetcher }).fetchDirectory();

    expect(result).toEqual([
      {
        dartCorpCode: "00126380",
        nameKo: "삼성전자",
        nameEn: "Samsung Electronics",
        stockCode: "005930",
        sourceUpdatedOn: "2026-09-09",
      },
      {
        dartCorpCode: "00000001",
        nameKo: "비상장회사",
        nameEn: null,
        stockCode: null,
        sourceUpdatedOn: "2026-09-08",
      },
    ]);
  });

  it("maps the official rate-limit status without logging the API key", async () => {
    const fetcher = vi.fn(async () =>
      new Response("<result><status>020</status><message>요청 제한</message></result>", { status: 200 }),
    );
    await expect(
      new OpenDartCompanyClient({ apiKey: "secret".padEnd(40, "x"), fetcher }).fetchDirectory(),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("rejects malformed archives", async () => {
    const fetcher = vi.fn(async () => new Response("not-a-zip", { status: 200 }));
    await expect(
      new OpenDartCompanyClient({ apiKey: "x".repeat(40), fetcher }).fetchDirectory(),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});

import { describe, expect, it, vi } from "vitest";
import { KrxDailyPriceClient } from "@/jobs/collector/krx-daily-price-client";

const range = { stockCodes: ["005930"], from: "2026-09-09", to: "2026-09-09" } as const;
const row = {
  BAS_DD: "20260909",
  ISU_CD: "005930",
  TDD_CLSPRC: "70,500",
  TDD_OPNPRC: "70,000",
  TDD_HGPRC: "71,000",
  TDD_LWPRC: "69,500",
  ACC_TRDVOL: "12,345,678",
};

describe("KrxDailyPriceClient", () => {
  it("requests all three KRX equity markets and maps official OHLCV fields", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      const payload = url.includes("stk_bydd_trd") ? { OutBlock_1: [row] } : { OutBlock_1: [] };
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    const client = new KrxDailyPriceClient({ apiKey: "private-key", fetcher });

    await expect(client.fetchDailyPrices(range)).resolves.toEqual([{
      stockCode: "005930",
      tradingDate: "2026-09-09",
      openPrice: "70000",
      highPrice: "71000",
      lowPrice: "69500",
      closePrice: "70500",
      volume: "12345678",
    }]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      "https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd?basDd=20260909",
      "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd?basDd=20260909",
      "https://data-dbg.krx.co.kr/svc/apis/sto/knx_bydd_trd?basDd=20260909",
    ]);
    const request = fetcher.mock.calls[0]?.[1];
    expect(request?.headers).toEqual(expect.objectContaining({ AUTH_KEY: "private-key" }));
    expect(String(fetcher.mock.calls[0]?.[0])).not.toContain("private-key");
  });

  it("accepts an empty market response and skips weekend requests", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ OutBlock_1: [] }), { status: 200 }));
    const client = new KrxDailyPriceClient({ apiKey: "private-key", fetcher });

    await expect(client.fetchDailyPrices({
      stockCodes: ["005930"],
      from: "2026-09-11",
      to: "2026-09-14",
    })).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });

  it("ignores official alphanumeric issue codes outside the requested common stocks", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({
      OutBlock_1: String(input).includes("stk_bydd_trd")
        ? [{ ...row, ISU_CD: "00104K" }, row]
        : [],
    }), { status: 200 }));

    await expect(new KrxDailyPriceClient({ apiKey: "private-key", fetcher }).fetchDailyPrices(range))
      .resolves.toHaveLength(1);
  });

  it("preserves the official no-trade representation", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({
      OutBlock_1: String(input).includes("knx_bydd_trd") ? [{
        ...row,
        TDD_OPNPRC: "0",
        TDD_HGPRC: "0",
        TDD_LWPRC: "0",
        ACC_TRDVOL: "0",
      }] : [],
    }), { status: 200 }));
    const result = await new KrxDailyPriceClient({ apiKey: "private-key", fetcher }).fetchDailyPrices(range);
    expect(result[0]).toMatchObject({ openPrice: "0", highPrice: "0", lowPrice: "0", closePrice: "70500", volume: "0" });
  });

  it.each([401, 403])("classifies HTTP %s as an authentication or approval error", async (status) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ respCode: String(status) }), { status }));
    await expect(new KrxDailyPriceClient({ apiKey: "private-key", fetcher }).fetchDailyPrices(range))
      .rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });
  });

  it("classifies request limits", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ respCode: "429" }), { status: 200 }));
    await expect(new KrxDailyPriceClient({ apiKey: "private-key", fetcher }).fetchDailyPrices(range))
      .rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retries a temporary KRX server failure once", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockImplementation(async () => new Response(JSON.stringify({ OutBlock_1: [] }), { status: 200 }));

    await expect(new KrxDailyPriceClient({ apiKey: "private-key", fetcher }).fetchDailyPrices(range))
      .resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("rejects malformed numbers", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      OutBlock_1: [{ ...row, TDD_CLSPRC: "not-a-number" }],
    }), { status: 200 }));
    await expect(new KrxDailyPriceClient({ apiKey: "private-key", fetcher }).fetchDailyPrices(range))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects a response for a different business date", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      OutBlock_1: [{ ...row, BAS_DD: "20260908" }],
    }), { status: 200 }));
    await expect(new KrxDailyPriceClient({ apiKey: "private-key", fetcher }).fetchDailyPrices(range))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});

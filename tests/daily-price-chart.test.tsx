import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DailyPriceChart } from "@/components/DailyPriceChart";
import type { DailyPriceSnapshot } from "@/domain/daily-price";

const krxSnapshot: DailyPriceSnapshot = {
  period: "1M",
  points: [
    { tradingDate: "2026-09-09", closePrice: 72_500, volume: 90, sourceId: "KRX_DAILY" },
    { tradingDate: "2026-09-10", closePrice: 74_000, volume: 100, sourceId: "KRX_DAILY" },
  ],
  latest: { tradingDate: "2026-09-10", closePrice: 74_000, volume: 100, sourceId: "KRX_DAILY" },
  sourceId: "KRX_DAILY",
  changeAmount: 1_500,
  changeRate: 2.069,
};

describe("DailyPriceChart source disclosure", () => {
  it("shows the Korea Exchange source for KRX data", () => {
    const markup = renderToStaticMarkup(<DailyPriceChart companyName="삼성전자" snapshot={krxSnapshot} />);
    expect(markup).toContain("출처: 한국거래소 통계정보");
  });

  it("does not claim a source in the empty state", () => {
    const markup = renderToStaticMarkup(<DailyPriceChart companyName="삼성전자" snapshot={{
      ...krxSnapshot,
      points: [],
      latest: null,
      sourceId: null,
      changeAmount: null,
      changeRate: null,
    }} />);
    expect(markup).toContain("일별 주가 준비 중");
    expect(markup).not.toContain("출처:");
  });

  it("does not label an unknown provider as KRX", () => {
    const markup = renderToStaticMarkup(<DailyPriceChart companyName="삼성전자" snapshot={{
      ...krxSnapshot,
      sourceId: "OTHER_PROVIDER",
    }} />);
    expect(markup).not.toContain("한국거래소");
  });
});

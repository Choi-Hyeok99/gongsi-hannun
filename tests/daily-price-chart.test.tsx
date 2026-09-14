import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DailyPriceChart } from "@/components/DailyPriceChart";
import type { DailyPriceSnapshot } from "@/domain/daily-price";

const krxSnapshot: DailyPriceSnapshot = {
  status: "READY",
  period: "1M",
  points: [
    { tradingDate: "2026-09-09", closePrice: 72_500, volume: 90, sourceId: "KRX_DAILY" },
    { tradingDate: "2026-09-10", closePrice: 74_000, volume: 100, sourceId: "KRX_DAILY" },
  ],
  latest: { tradingDate: "2026-09-10", closePrice: 74_000, volume: 100, sourceId: "KRX_DAILY" },
  previous: { tradingDate: "2026-09-09", closePrice: 72_500, volume: 90, sourceId: "KRX_DAILY" },
  sourceId: "KRX_DAILY",
  changeAmount: 1_500,
  changeRate: 2.069,
};

describe("DailyPriceChart source disclosure", () => {
  it("shows the Korea Exchange source for KRX data", () => {
    const markup = renderToStaticMarkup(<DailyPriceChart companyName="삼성전자" snapshot={krxSnapshot} />);
    expect(markup).toContain("출처: 한국거래소 통계정보");
    expect(markup).toContain("직전 거래일(26.09.09) 대비");
  });

  it("uses a compact KRX label and an explicit direction symbol in cards", () => {
    const markup = renderToStaticMarkup(<DailyPriceChart companyName="삼성전자" snapshot={krxSnapshot} compact />);
    expect(markup).toContain("최근 1개월 일별 종가 · KRX");
    expect(markup).toContain("▲");
  });

  it("does not claim a source in the empty state", () => {
    const markup = renderToStaticMarkup(<DailyPriceChart companyName="삼성전자" snapshot={{
      ...krxSnapshot,
      points: [],
      latest: null,
      previous: null,
      sourceId: null,
      changeAmount: null,
      changeRate: null,
      status: "NO_DATA",
    }} />);
    expect(markup).toContain("수집된 KRX 일별 종가 없음");
    expect(markup).not.toContain("출처:");
  });

  it("does not label an unknown provider as KRX", () => {
    const markup = renderToStaticMarkup(<DailyPriceChart companyName="삼성전자" snapshot={{
      ...krxSnapshot,
      sourceId: "OTHER_PROVIDER",
    }} />);
    expect(markup).not.toContain("한국거래소");
  });

  it("shows a single real close and basis date without a chart or change rate", () => {
    const markup = renderToStaticMarkup(<DailyPriceChart companyName="삼성전자" snapshot={{
      ...krxSnapshot,
      status: "INSUFFICIENT_HISTORY",
      points: [krxSnapshot.latest!],
      previous: null,
      changeAmount: null,
      changeRate: null,
    }} />);
    expect(markup).toContain("74,000원");
    expect(markup).toContain("기준일 26.09.10");
    expect(markup).toContain("비교 가능한 직전 거래일 데이터 없음");
    expect(markup).not.toContain("<svg");
    expect(markup).not.toContain("%");
  });

  it("distinguishes stale and query error states", () => {
    const staleMarkup = renderToStaticMarkup(<DailyPriceChart companyName="삼성전자" snapshot={{ ...krxSnapshot, status: "STALE" }} />);
    const errorMarkup = renderToStaticMarkup(<DailyPriceChart companyName="삼성전자" snapshot={{ ...krxSnapshot, status: "ERROR", points: [], latest: null, previous: null, sourceId: null, changeAmount: null, changeRate: null }} />);
    expect(staleMarkup).toContain("최신 일별 종가 수집 지연");
    expect(errorMarkup).toContain("주가 데이터 조회 오류");
  });
});

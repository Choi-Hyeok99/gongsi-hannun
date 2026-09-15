import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/watchlist/actions", () => ({
  updateWatchlistAlertPreference: vi.fn(),
}));

import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { WatchlistAlertCard } from "@/components/WatchlistAlertCard";

describe("notification preference UI", () => {
  it("explains PC and mobile browser push support", () => {
    const markup = renderToStaticMarkup(<PushNotificationSettings />);
    expect(markup).toContain("PC·휴대폰 브라우저 알림");
    expect(markup).toContain("85점 이상 핵심 공시");
  });

  it("renders three importance presets for each watched company", () => {
    const markup = renderToStaticMarkup(<WatchlistAlertCard
      company={{ id: "company-1", stockCode: "005930", name: "삼성전자", market: "KOSPI", sector: "반도체" }}
      preference={{ companyId: "company-1", enabled: true, minimumImportanceScore: 70, eventTypes: ["EARNINGS"] }}
    />);
    expect(markup).toContain("넓게 받기 · 60점 이상");
    expect(markup).toContain("기본 추천 · 70점 이상");
    expect(markup).toContain("핵심만 받기 · 85점 이상");
    expect(markup).toContain("공시 유형 세부 선택");
  });
});

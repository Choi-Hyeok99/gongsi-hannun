import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DisclosureSummary } from "@/domain/disclosure-query";

const navigationState = vi.hoisted(() => ({ pathname: "/calendar" }));
const listDisclosureCalendar = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ usePathname: () => navigationState.pathname }));
vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => <header>공시한눈</header> }));
vi.mock("@/components/SiteFooter", () => ({ SiteFooter: () => <footer /> }));
vi.mock("@/data/supabase-disclosure-repository", () => ({ createDisclosureRepository: () => ({}) }));
vi.mock("@/server/disclosure-use-cases", () => ({
  listDisclosureCalendar,
  resolveDisclosureCalendarMonth: (month: string | null) => month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : "2026-09",
}));

import CalendarPage from "@/app/calendar/page";
import { PrimaryNavigation } from "@/components/PrimaryNavigation";
import { resolveSelectedCalendarDay } from "@/components/disclosure-calendar-selection";

const sample: DisclosureSummary = {
  receiptNumber: "20260909000001",
  reportName: "단일판매ㆍ공급계약체결",
  filerName: "삼성전자",
  disclosedOn: "2026-09-09",
  originalUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260909000001",
  status: "ACTIVE",
  eventType: "SUPPLY_CONTRACT",
  company: { stockCode: "005930", name: "삼성전자", market: "KOSPI" },
};

describe("mobile primary navigation", () => {
  it.each([
    ["/search", "/search"],
    ["/companies/005930", "/search"],
    ["/disclosures/20260909000001", "/disclosures"],
    ["/calendar", "/calendar"],
  ])("marks %s with the matching current destination", (pathname, currentHref) => {
    navigationState.pathname = pathname;
    const markup = renderToStaticMarkup(<PrimaryNavigation />);

    expect(markup).toContain("기업");
    expect(markup).toContain("최근 주요 공시");
    expect(markup).toContain("공시 달력");
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toMatch(new RegExp(`aria-current="page" href="${currentHref}"|href="${currentHref}" aria-current="page"`));
  });
});

describe("mobile disclosure calendar", () => {
  beforeEach(() => {
    listDisclosureCalendar.mockResolvedValue({ month: "2026-09", items: [sample] });
  });

  it("renders a seven-column month selector and the selected date disclosures", async () => {
    const markup = renderToStaticMarkup(await CalendarPage({ searchParams: Promise.resolve({ month: "2026-09", day: "09" }) }));

    expect(markup).toContain("aria-label=\"2026년 9월 모바일 달력\"");
    expect(markup).toContain("aria-label=\"9월 9일, 주요 공시 1건\"");
    expect(markup).toContain("aria-current=\"date\"");
    expect(markup).toContain("9월 9일 주요 공시");
    expect(markup).toContain("href=\"/calendar?month=2026-09&amp;day=09\"");
  });

  it("keeps valid empty dates selectable and explains their empty state", async () => {
    const markup = renderToStaticMarkup(await CalendarPage({ searchParams: Promise.resolve({ month: "2026-09", day: "10" }) }));

    expect(markup).toContain("9월 10일 주요 공시");
    expect(markup).toContain("선택한 날짜의 주요 공시가 없습니다.");
  });

  it("falls back to the first disclosure day when the requested date is invalid", () => {
    expect(resolveSelectedCalendarDay("40", 30, new Map([[9, [sample]]]).keys())).toBe(9);
    expect(resolveSelectedCalendarDay(undefined, 30, new Map().keys())).toBe(1);
  });

  it("renders a factual recovery notice when the calendar query fails", async () => {
    listDisclosureCalendar.mockRejectedValueOnce(new Error("offline"));

    const markup = renderToStaticMarkup(await CalendarPage({ searchParams: Promise.resolve({ month: "2026-09" }) }));

    expect(markup).toContain("공시 일정을 불러오지 못했습니다.");
    expect(markup).not.toContain("Application error");
  });
});

describe("responsive presentation contract", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const css = readFileSync(`${root}/src/app/globals.css`, "utf8");
  const home = readFileSync(`${root}/src/app/page.tsx`, "utf8");

  it("keeps the primary navigation and interactive monthly calendar in the mobile breakpoint", () => {
    const mobileRules = css.slice(css.indexOf("@media (max-width: 767px)"), css.indexOf("@media (min-width: 768px)"));
    expect(mobileRules).toContain(".primary-navigation { display: grid");
    expect(mobileRules).toContain("min-height: 46px");
    expect(mobileRules).toContain(".calendar-mobile { display: grid");
    expect(mobileRules).toContain("grid-template-columns: repeat(7");
    expect(mobileRules).not.toContain(".primary-navigation { display: none");
  });

  it("uses the configured collection interval instead of claiming real-time updates", () => {
    expect(home).toContain("평일 10분 간격 수집");
    expect(home).not.toContain("실시간 업데이트");
  });
});

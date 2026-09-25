import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeCompanyCount, HomeDisclosureCollectionStatus } from "@/components/HomeDataStatus";
import { SupabaseHomeStatusRepository } from "@/data/supabase-home-status-repository";
import type { HomeStatusRepository } from "@/domain/home-status";
import { getHomeOperationalStatus, resolveDisclosureCollectionState } from "@/server/home-status-use-cases";

vi.mock("server-only", () => ({}));

describe("home operational status", () => {
  it("combines the live company count with a current successful collection", async () => {
    const repository: HomeStatusRepository = {
      countActiveListedCompanies: vi.fn(async () => 3_930),
      findLastSuccessfulDisclosureCollectionAt: vi.fn(async () => "2026-09-14T01:05:00.000Z"),
    };

    await expect(getHomeOperationalStatus(() => repository, new Date("2026-09-14T01:20:00.000Z"))).resolves.toEqual({
      activeCompanyCount: 3_930,
      lastSuccessfulDisclosureCollectionAt: "2026-09-14T01:05:00.000Z",
      disclosureCollectionState: "CURRENT",
    });
  });

  it("keeps each available value when the other database lookup fails", async () => {
    const repository: HomeStatusRepository = {
      countActiveListedCompanies: vi.fn(async () => { throw new Error("count failed"); }),
      findLastSuccessfulDisclosureCollectionAt: vi.fn(async () => "2026-09-14T01:05:00.000Z"),
    };

    await expect(getHomeOperationalStatus(() => repository, new Date("2026-09-14T01:20:00.000Z"))).resolves.toMatchObject({
      activeCompanyCount: null,
      lastSuccessfulDisclosureCollectionAt: "2026-09-14T01:05:00.000Z",
      disclosureCollectionState: "CURRENT",
    });
  });

  it("returns factual unavailable states when repository setup fails", async () => {
    await expect(getHomeOperationalStatus(() => { throw new Error("missing environment"); })).resolves.toEqual({
      activeCompanyCount: null,
      lastSuccessfulDisclosureCollectionAt: null,
      disclosureCollectionState: "UNAVAILABLE",
    });
  });

  it("only reports a delay during the configured weekday collection window", () => {
    expect(resolveDisclosureCollectionState("2026-09-14T00:00:00.000Z", new Date("2026-09-14T02:00:00.000Z"))).toBe("DELAYED");
    expect(resolveDisclosureCollectionState("2026-09-11T11:50:00.000Z", new Date("2026-09-12T02:00:00.000Z"))).toBe("OUTSIDE_COLLECTION_HOURS");
    expect(resolveDisclosureCollectionState("not-a-date", new Date("2026-09-14T02:00:00.000Z"))).toBe("UNAVAILABLE");
  });
});

describe("Supabase home status repository", () => {
  it("counts active listed KOSPI and KOSDAQ companies", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ count: 3_930, error: null }),
    };
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient;

    await expect(new SupabaseHomeStatusRepository(client).countActiveListedCompanies()).resolves.toBe(3_930);
    expect(client.from).toHaveBeenCalledWith("companies");
    expect(query.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(query.eq).toHaveBeenNthCalledWith(1, "is_active", true);
    expect(query.eq).toHaveBeenNthCalledWith(2, "is_listed", true);
    expect(query.in).toHaveBeenCalledWith("market", ["KOSPI", "KOSDAQ"]);
  });

  it("reads only the latest successful disclosure collection completion", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { finished_at: "2026-09-14T01:05:00.000Z" }, error: null }),
    };
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient;

    await expect(new SupabaseHomeStatusRepository(client).findLastSuccessfulDisclosureCollectionAt()).resolves.toBe("2026-09-14T01:05:00.000Z");
    expect(query.eq).toHaveBeenNthCalledWith(1, "job_type", "DISCLOSURE_COLLECT");
    expect(query.eq).toHaveBeenNthCalledWith(2, "status", "SUCCEEDED");
    expect(query.order).toHaveBeenCalledWith("finished_at", { ascending: false });
  });
});

describe("home status presentation", () => {
  it("renders database values and the actual collection schedule", () => {
    const status = { activeCompanyCount: 3_930, lastSuccessfulDisclosureCollectionAt: "2026-09-14T01:05:00.000Z", disclosureCollectionState: "CURRENT" } as const;
    const markup = renderToStaticMarkup(<><HomeCompanyCount count={status.activeCompanyCount} /><HomeDisclosureCollectionStatus status={status} /></>);

    expect(markup).toContain("3,930개 상장기업 정보를 연결했습니다");
    expect(markup).toContain("최근 성공 수집 9월 14일 10:05");
    expect(markup).toContain("평일 08:00~20:59에 10분 간격");
    expect(markup).toContain("정상 수집 중");
  });

  it("does not invent values when operational data is unavailable", () => {
    const status = { activeCompanyCount: null, lastSuccessfulDisclosureCollectionAt: null, disclosureCollectionState: "UNAVAILABLE" } as const;
    const markup = renderToStaticMarkup(<><HomeCompanyCount count={status.activeCompanyCount} /><HomeDisclosureCollectionStatus status={status} /></>);

    expect(markup).toContain("집계 정보 없음");
    expect(markup).toContain("최근 수집 시각 확인 불가");
  });

  it("removes the previous hard-coded company total from the home page", () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const home = readFileSync(`${root}/src/app/page.tsx`, "utf8");
    expect(home).not.toContain("3,931");
    expect(home).not.toContain('name: "삼성전자"');
    expect(home).not.toContain('stockCode: "005930"');
    expect(home).toContain("operationalStatus.activeCompanyCount");
    expect(home).toContain("listFeaturedCompanies");
  });
});

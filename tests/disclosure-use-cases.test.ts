import { describe, expect, it, vi } from "vitest";
import type { DisclosureRepository, DisclosureSummary } from "@/domain/disclosure-query";
import { findCorrectionTimeline, getDisclosure, listCompanyDisclosures, listDisclosureCalendar, listLatestDisclosures, searchDisclosures } from "@/server/disclosure-use-cases";

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

class FixtureDisclosureRepository implements DisclosureRepository {
  async findLatest(): Promise<readonly DisclosureSummary[]> { return [sample]; }
  async search(): Promise<{ items: readonly DisclosureSummary[]; totalCount: number }> {
    return { items: [sample], totalCount: 1 };
  }
  async findByReceiptNumber(receiptNumber: string): Promise<DisclosureSummary | null> {
    return receiptNumber === sample.receiptNumber ? sample : null;
  }
  async findByCompanyStockCode(stockCode: string): Promise<readonly DisclosureSummary[]> {
    return stockCode === sample.company.stockCode ? [sample] : [];
  }
  async findByDateRange(): Promise<readonly DisclosureSummary[]> { return [sample]; }
}

describe("disclosure use cases", () => {
  const repository = new FixtureDisclosureRepository();

  it("lists latest disclosures", async () => {
    await expect(listLatestDisclosures(repository, 8)).resolves.toEqual([sample]);
  });

  it("normalizes disclosure search parameters", async () => {
    const search = vi.spyOn(repository, "search");
    await expect(searchDisclosures(
      repository,
      "2026-09-09",
      "2",
      "SUPPLY_CONTRACT",
      " 삼성전자,() % ",
    )).resolves.toMatchObject({
      date: "2026-09-09",
      eventType: "SUPPLY_CONTRACT",
      term: "삼성전자",
      page: 2,
      pageSize: 30,
      totalCount: 1,
    });
    expect(search).toHaveBeenLastCalledWith({
      date: "2026-09-09",
      eventType: "SUPPLY_CONTRACT",
      term: "삼성전자",
      page: 2,
      pageSize: 30,
    });
  });

  it("falls back for invalid disclosure search parameters", async () => {
    await expect(searchDisclosures(repository, "2026-02-31", "-1", "UNKNOWN", "***")).resolves.toMatchObject({
      date: null,
      eventType: null,
      term: null,
      page: 1,
    });
  });

  it("does not query an invalid receipt number", async () => {
    const find = vi.spyOn(repository, "findByReceiptNumber");
    await expect(getDisclosure(repository, "invalid")).resolves.toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  it("lists disclosures for a valid company code", async () => {
    await expect(listCompanyDisclosures(repository, "005930")).resolves.toEqual([sample]);
  });

  it("does not query an invalid company code", async () => {
    const find = vi.spyOn(repository, "findByCompanyStockCode");
    await expect(listCompanyDisclosures(repository, "5930")).resolves.toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });

  it("lists a valid disclosure calendar month", async () => {
    await expect(listDisclosureCalendar(repository, "2026-09")).resolves.toMatchObject({ month: "2026-09", items: [sample] });
  });

  it("groups an original disclosure with its correction", () => {
    const correction = { ...sample, receiptNumber: "20260910000001", reportName: "[기재정정]단일판매ㆍ공급계약체결", disclosedOn: "2026-09-10" };
    expect(findCorrectionTimeline(correction, [correction, sample])).toHaveLength(2);
  });
});

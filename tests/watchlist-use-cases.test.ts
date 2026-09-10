import { describe, expect, it, vi } from "vitest";
import type { WatchlistCompanyReader, WatchlistRepository } from "@/domain/watchlist";
import { parseWatchlistCommand } from "@/domain/watchlist";
import { getSavedState, listSavedCompanies, setSavedState } from "@/server/watchlist-use-cases";

function createRepository(): WatchlistRepository {
  return {
    listCompanyIds: vi.fn().mockResolvedValue(["company-2", "company-1"]),
    isSaved: vi.fn().mockResolvedValue(true),
    save: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

function createReader(): WatchlistCompanyReader {
  return {
    findByIds: vi.fn().mockResolvedValue([
      { id: "company-2", stockCode: "000660", name: "SK하이닉스", market: "KOSPI", sector: "반도체" },
      { id: "company-1", stockCode: "005930", name: "삼성전자", market: "KOSPI", sector: "반도체" },
    ]),
    findByStockCode: vi.fn(),
  };
}

describe("parseWatchlistCommand", () => {
  it("accepts an explicit save command", () => {
    const formData = new FormData();
    formData.set("stockCode", "005930");
    formData.set("intent", "save");
    expect(parseWatchlistCommand(formData)).toEqual({ success: true, stockCode: "005930", intent: "save" });
  });

  it.each([
    ["5930", "save"],
    ["005930", "toggle"],
    ["javascript:alert(1)", "remove"],
  ])("rejects stock code %s with intent %s", (stockCode, intent) => {
    const formData = new FormData();
    formData.set("stockCode", stockCode);
    formData.set("intent", intent);
    expect(parseWatchlistCommand(formData)).toEqual({ success: false });
  });
});

describe("watchlist use cases", () => {
  it("loads only company ids returned for the authenticated owner", async () => {
    const repository = createRepository();
    const reader = createReader();
    const companies = await listSavedCompanies(repository, reader, "user-1");
    expect(repository.listCompanyIds).toHaveBeenCalledWith("user-1");
    expect(reader.findByIds).toHaveBeenCalledWith(["company-2", "company-1"]);
    expect(companies).toHaveLength(2);
  });

  it("checks saved state with both owner and company ids", async () => {
    const repository = createRepository();
    await expect(getSavedState(repository, "user-1", "company-1")).resolves.toBe(true);
    expect(repository.isSaved).toHaveBeenCalledWith("user-1", "company-1");
  });

  it("saves for the authenticated owner", async () => {
    const repository = createRepository();
    await setSavedState(repository, "user-1", "company-1", "save");
    expect(repository.save).toHaveBeenCalledWith("user-1", "company-1");
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it("removes only the authenticated owner's entry", async () => {
    const repository = createRepository();
    await setSavedState(repository, "user-1", "company-1", "remove");
    expect(repository.remove).toHaveBeenCalledWith("user-1", "company-1");
    expect(repository.save).not.toHaveBeenCalled();
  });
});

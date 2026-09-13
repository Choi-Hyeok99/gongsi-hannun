export type WatchlistIntent = "save" | "remove";

export type WatchlistCompany = Readonly<{
  id: string;
  stockCode: string;
  name: string;
  market: string;
  sector: string | null;
}>;

export interface WatchlistRepository {
  listCompanyIds(userId: string): Promise<readonly string[]>;
  isSaved(userId: string, companyId: string): Promise<boolean>;
  save(userId: string, companyId: string): Promise<void>;
  remove(userId: string, companyId: string): Promise<void>;
}

export interface WatchlistCompanyReader {
  findByIds(companyIds: readonly string[]): Promise<readonly WatchlistCompany[]>;
  findByStockCode(stockCode: string): Promise<WatchlistCompany | null>;
}

export function parseWatchlistCommand(formData: FormData):
  | Readonly<{ success: true; stockCode: string; intent: WatchlistIntent }>
  | Readonly<{ success: false }> {
  const stockCode = formData.get("stockCode");
  const intent = formData.get("intent");
  if (typeof stockCode !== "string" || !/^[0-9]{6}$/.test(stockCode)) return { success: false };
  if (intent !== "save" && intent !== "remove") return { success: false };
  return { success: true, stockCode, intent };
}

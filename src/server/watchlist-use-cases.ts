import type { WatchlistCompany, WatchlistCompanyReader, WatchlistIntent, WatchlistRepository } from "@/domain/watchlist";

export async function listSavedCompanies(
  repository: WatchlistRepository,
  companyReader: WatchlistCompanyReader,
  userId: string,
): Promise<readonly WatchlistCompany[]> {
  const companyIds = await repository.listCompanyIds(userId);
  return companyReader.findByIds(companyIds);
}

export async function getSavedState(
  repository: WatchlistRepository,
  userId: string,
  companyId: string,
): Promise<boolean> {
  return repository.isSaved(userId, companyId);
}

export async function setSavedState(
  repository: WatchlistRepository,
  userId: string,
  companyId: string,
  intent: WatchlistIntent,
): Promise<void> {
  if (intent === "save") await repository.save(userId, companyId);
  else await repository.remove(userId, companyId);
}

export const DISCLOSURE_COLLECTION_INTERVAL_MINUTES = 10;

export type DisclosureCollectionState = "CURRENT" | "DELAYED" | "OUTSIDE_COLLECTION_HOURS" | "UNAVAILABLE";

export type HomeOperationalStatus = Readonly<{
  activeCompanyCount: number | null;
  lastSuccessfulDisclosureCollectionAt: string | null;
  disclosureCollectionState: DisclosureCollectionState;
}>;

export interface HomeStatusRepository {
  countActiveListedCompanies(): Promise<number>;
  findLastSuccessfulDisclosureCollectionAt(): Promise<string | null>;
}

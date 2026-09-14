import type { DisclosureCollectionState, HomeOperationalStatus, HomeStatusRepository } from "@/domain/home-status";

const DELAY_THRESHOLD_MINUTES = 30;

export async function getHomeOperationalStatus(
  createRepository: () => HomeStatusRepository,
  now = new Date(),
): Promise<HomeOperationalStatus> {
  let repository: HomeStatusRepository;
  try {
    repository = createRepository();
  } catch {
    return unavailableStatus();
  }

  const [companyCountResult, lastCollectionResult] = await Promise.allSettled([
    repository.countActiveListedCompanies(),
    repository.findLastSuccessfulDisclosureCollectionAt(),
  ]);
  const activeCompanyCount = companyCountResult.status === "fulfilled" ? companyCountResult.value : null;
  const lastSuccessfulDisclosureCollectionAt = lastCollectionResult.status === "fulfilled" ? lastCollectionResult.value : null;

  return {
    activeCompanyCount,
    lastSuccessfulDisclosureCollectionAt,
    disclosureCollectionState: resolveDisclosureCollectionState(lastSuccessfulDisclosureCollectionAt, now),
  };
}

export function resolveDisclosureCollectionState(lastSuccessfulAt: string | null, now: Date): DisclosureCollectionState {
  if (!lastSuccessfulAt) return "UNAVAILABLE";
  const lastSuccessfulTime = new Date(lastSuccessfulAt).getTime();
  if (!Number.isFinite(lastSuccessfulTime)) return "UNAVAILABLE";
  if (!isWithinCollectionHours(now)) return "OUTSIDE_COLLECTION_HOURS";
  const elapsedMinutes = (now.getTime() - lastSuccessfulTime) / 60_000;
  return elapsedMinutes >= 0 && elapsedMinutes <= DELAY_THRESHOLD_MINUTES ? "CURRENT" : "DELAYED";
}

function isWithinCollectionHours(date: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find(({ type }) => type === "weekday")?.value;
  const hour = Number(parts.find(({ type }) => type === "hour")?.value);
  const minute = Number(parts.find(({ type }) => type === "minute")?.value);
  const minutesSinceMidnight = hour * 60 + minute;
  return weekday !== "Sat" && weekday !== "Sun" && minutesSinceMidnight >= 8 * 60 && minutesSinceMidnight < 21 * 60;
}

function unavailableStatus(): HomeOperationalStatus {
  return {
    activeCompanyCount: null,
    lastSuccessfulDisclosureCollectionAt: null,
    disclosureCollectionState: "UNAVAILABLE",
  };
}

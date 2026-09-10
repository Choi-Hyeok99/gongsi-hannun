import { categorizeCompanyIndustryCode } from "@/domain/company";
import type {
  CompanyIndustrySource,
  CompanyIndustrySyncCounts,
  CompanyIndustrySyncRepository,
} from "@/domain/company-industry-sync";
import { ExternalServiceError } from "@/domain/errors";

type Dependencies = Readonly<{
  source: CompanyIndustrySource;
  repository: CompanyIndustrySyncRepository;
  batchSize?: number;
  maxCompanies?: number;
  delayMs?: number;
  maxConsecutiveFailures?: number;
  pause?: (delayMs: number) => Promise<void>;
}>;

export async function syncCompanyIndustries(
  dependencies: Dependencies,
): Promise<CompanyIndustrySyncCounts> {
  const batchSize = constrainInteger(dependencies.batchSize ?? 100, 1, 500);
  const maxCompanies = constrainInteger(dependencies.maxCompanies ?? 4_000, 1, 20_000);
  const delayMs = constrainInteger(dependencies.delayMs ?? 120, 0, 10_000);
  const maxConsecutiveFailures = constrainInteger(dependencies.maxConsecutiveFailures ?? 10, 1, 100);
  const pause = dependencies.pause ?? wait;
  const runId = await dependencies.repository.startRun();
  let attemptedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  let afterId: string | undefined;
  let stoppedReason: string | undefined;
  let consecutiveFailures = 0;

  while (attemptedCount < maxCompanies) {
    const targets = await dependencies.repository.findPending(
      Math.min(batchSize, maxCompanies - attemptedCount),
      afterId,
    );
    if (targets.length === 0) break;

    for (const target of targets) {
      attemptedCount += 1;
      afterId = target.id;
      try {
        const profile = await dependencies.source.fetchProfile(target.dartCorpCode);
        const category = categorizeCompanyIndustryCode(profile?.industryCode ?? null);
        await dependencies.repository.saveProfile(target, profile, category);
        updatedCount += 1;
        consecutiveFailures = 0;
      } catch (error) {
        failedCount += 1;
        consecutiveFailures += 1;
        await dependencies.repository.recordFailure(target, error);
        if (error instanceof ExternalServiceError && error.code === "RATE_LIMITED") {
          stoppedReason = "RATE_LIMITED";
          const counts = await buildCounts(dependencies.repository, attemptedCount, updatedCount, failedCount);
          await dependencies.repository.finishRun(runId, counts, stoppedReason);
          throw error;
        }
        if (consecutiveFailures >= maxConsecutiveFailures) {
          stoppedReason = "CONSECUTIVE_FAILURE_LIMIT";
          break;
        }
      }
      if (attemptedCount < maxCompanies) await pause(delayMs);
    }
    if (stoppedReason) break;
  }

  const counts = await buildCounts(dependencies.repository, attemptedCount, updatedCount, failedCount);
  if (!stoppedReason && counts.remainingCount > 0) {
    stoppedReason = attemptedCount === maxCompanies ? "MAX_COMPANIES_REACHED" : "FAILED_COMPANIES_REMAIN";
  }
  await dependencies.repository.finishRun(runId, counts, stoppedReason);
  return counts;
}

async function buildCounts(
  repository: CompanyIndustrySyncRepository,
  attemptedCount: number,
  updatedCount: number,
  failedCount: number,
): Promise<CompanyIndustrySyncCounts> {
  return { attemptedCount, updatedCount, failedCount, remainingCount: await repository.countPending() };
}

function constrainInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`값은 ${minimum} 이상 ${maximum} 이하의 정수여야 합니다.`);
  }
  return value;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

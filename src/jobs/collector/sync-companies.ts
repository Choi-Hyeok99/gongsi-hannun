import type {
  CompanyDirectorySource,
  CompanySyncCounts,
  CompanySyncRepository,
  ListedCompanyInput,
} from "@/domain/company-sync";
import { ExternalServiceError } from "@/domain/errors";

type Dependencies = Readonly<{
  source: CompanyDirectorySource;
  repository: CompanySyncRepository;
}>;

export async function syncCompanies(dependencies: Dependencies): Promise<CompanySyncCounts> {
  const runId = await dependencies.repository.startRun();
  let readCount = 0;

  try {
    const directory = await dependencies.source.fetchDirectory();
    readCount = directory.length;
    const listed = directory
      .filter((company): company is typeof company & { stockCode: string } => company.stockCode !== null)
      .map<ListedCompanyInput>((company) => ({
        dartCorpCode: company.dartCorpCode,
        nameKo: company.nameKo,
        nameEn: company.nameEn,
        stockCode: company.stockCode,
        sourceUpdatedOn: company.sourceUpdatedOn,
      }));

    if (listed.length === 0) {
      throw new ExternalServiceError("INVALID_RESPONSE", "상장 기업이 한 건도 없어 저장을 중단했습니다.");
    }

    const result = await dependencies.repository.upsertListedCompanies(listed);
    const counts = { readCount, ...result };
    await dependencies.repository.completeRun(runId, counts);
    return counts;
  } catch (error) {
    await dependencies.repository.failRun(runId, readCount, error);
    throw error;
  }
}

import { z } from "zod";
import { createSupabaseCompanyIndustrySyncRepository } from "@/data/supabase-company-industry-sync-repository";
import { OpenDartCompanyProfileClient } from "@/jobs/collector/open-dart-company-profile-client";
import { syncCompanyIndustries } from "@/jobs/collector/sync-company-industries";

const environmentSchema = z.object({
  OPENDART_API_KEY: z.string().regex(/^[A-Za-z0-9]{40}$/),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
  COMPANY_INDUSTRY_SYNC_MAX: z.coerce.number().int().min(1).max(20_000).optional(),
  COMPANY_INDUSTRY_SYNC_DELAY_MS: z.coerce.number().int().min(0).max(10_000).optional(),
});

async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const counts = await syncCompanyIndustries({
    source: new OpenDartCompanyProfileClient({ apiKey: environment.OPENDART_API_KEY }),
    repository: createSupabaseCompanyIndustrySyncRepository({
      supabaseUrl: environment.SUPABASE_URL,
      supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
    }),
    maxCompanies: environment.COMPANY_INDUSTRY_SYNC_MAX,
    delayMs: environment.COMPANY_INDUSTRY_SYNC_DELAY_MS,
  });
  console.info(
    `업종 동기화 완료: 시도 ${counts.attemptedCount}, 갱신 ${counts.updatedCount}, 실패 ${counts.failedCount}, 남음 ${counts.remainingCount}`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "업종 동기화에 실패했습니다.";
  console.error(message);
  process.exitCode = 1;
});

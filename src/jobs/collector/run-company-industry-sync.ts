import { z } from "zod";
import { createSupabaseCompanyIndustrySyncRepository } from "@/data/supabase-company-industry-sync-repository";
import { OpenDartCompanyProfileClient } from "@/jobs/collector/open-dart-company-profile-client";
import { syncCompanyIndustries } from "@/jobs/collector/sync-company-industries";

const environmentSchema = z.object({
  OPENDART_API_KEY: z.string().regex(/^[A-Za-z0-9]{40}$/),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
  COMPANY_INDUSTRY_SYNC_LIMIT: z.coerce.number().int().min(1).max(500).optional(),
  COMPANY_INDUSTRY_SYNC_AFTER_ID: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.uuid().optional(),
  ),
  COMPANY_INDUSTRY_SYNC_DELAY_MS: z.coerce.number().int().min(0).max(10_000).optional(),
});

export function parseCompanyIndustrySyncArguments(args: readonly string[]): Readonly<{ limit?: number; afterId?: string }> {
  let limit: number | undefined;
  let afterId: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--limit" && value) {
      limit = z.coerce.number().int().min(1).max(500).parse(value);
      index += 1;
      continue;
    }
    if (argument === "--after-id" && value) {
      afterId = z.uuid().parse(value);
      index += 1;
      continue;
    }
    throw new Error(`지원하지 않는 인자입니다: ${argument ?? ""}`);
  }
  return { limit, afterId };
}

async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const arguments_ = parseCompanyIndustrySyncArguments(process.argv.slice(2));
  const limit = arguments_.limit ?? environment.COMPANY_INDUSTRY_SYNC_LIMIT ?? 250;
  const startingAfterId = arguments_.afterId ?? environment.COMPANY_INDUSTRY_SYNC_AFTER_ID;
  const counts = await syncCompanyIndustries({
    source: new OpenDartCompanyProfileClient({ apiKey: environment.OPENDART_API_KEY }),
    repository: createSupabaseCompanyIndustrySyncRepository({
      supabaseUrl: environment.SUPABASE_URL,
      supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
    }),
    maxCompanies: limit,
    startingAfterId,
    delayMs: environment.COMPANY_INDUSTRY_SYNC_DELAY_MS,
  });
  console.info(
    `업종 동기화 완료: 시도 ${counts.attemptedCount}, 갱신 ${counts.updatedCount}, 실패 ${counts.failedCount}, 남음 ${counts.remainingCount}, 다음 커서 ${counts.nextCursor ?? "없음"}`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "업종 동기화에 실패했습니다.";
  console.error(message);
  process.exitCode = 1;
});

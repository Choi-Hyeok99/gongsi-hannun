import { z } from "zod";
import { createSupabaseCompanyIndustrySyncRepository } from "@/data/supabase-company-industry-sync-repository";

const environmentSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
});

async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const repository = createSupabaseCompanyIndustrySyncRepository({
    supabaseUrl: environment.SUPABASE_URL,
    supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
  });
  const completeness = await repository.getCompleteness();
  console.info(JSON.stringify(completeness, null, 2));

  if (process.argv.includes("--strict") && (
    completeness.marketOtherCount > 0
    || completeness.categoryUnclassifiedCount > 0
    || completeness.profilePendingCount > 0
  )) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "기업 분류 완결성 확인에 실패했습니다.");
  process.exitCode = 1;
});

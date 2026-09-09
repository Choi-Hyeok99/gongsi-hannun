import { z } from "zod";
import { createSupabaseCompanySyncRepository } from "@/data/supabase-company-sync-repository";
import { OpenDartCompanyClient } from "@/jobs/collector/open-dart-company-client";
import { syncCompanies } from "@/jobs/collector/sync-companies";

const environmentSchema = z.object({
  OPENDART_API_KEY: z.string().regex(/^[A-Za-z0-9]{40}$/),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
});

async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const counts = await syncCompanies({
    source: new OpenDartCompanyClient({ apiKey: environment.OPENDART_API_KEY }),
    repository: createSupabaseCompanySyncRepository({
      supabaseUrl: environment.SUPABASE_URL,
      supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
    }),
  });
  console.info(
    `기업 동기화 완료: 조회 ${counts.readCount}, 생성 ${counts.createdCount}, 갱신 ${counts.updatedCount}`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "기업 동기화에 실패했습니다.";
  console.error(message);
  process.exitCode = 1;
});

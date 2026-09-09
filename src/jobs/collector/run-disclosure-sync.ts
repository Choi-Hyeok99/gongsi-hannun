import { z } from "zod";
import { createSupabaseDisclosureSyncRepository } from "@/data/supabase-disclosure-sync-repository";
import { OpenDartClient } from "@/jobs/collector/open-dart-client";
import { syncDisclosures } from "@/jobs/collector/sync-disclosures";

const environmentSchema = z.object({
  OPENDART_API_KEY: z.string().regex(/^[A-Za-z0-9]{40}$/),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
});

const dateSchema = z.string().regex(/^\d{8}$/);

async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const today = currentKstDate();
  const fromDate = dateSchema.parse(process.argv[2] ?? today);
  const toDate = dateSchema.parse(process.argv[3] ?? fromDate);
  const counts = await syncDisclosures(
    {
      source: new OpenDartClient({ apiKey: environment.OPENDART_API_KEY }),
      repository: createSupabaseDisclosureSyncRepository({
        supabaseUrl: environment.SUPABASE_URL,
        supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
      }),
    },
    fromDate,
    toDate,
  );
  console.info(
    `공시 동기화 완료: 조회 ${counts.readCount}, 생성 ${counts.createdCount}, 갱신 ${counts.updatedCount}, 실패 ${counts.failedCount}`,
  );
}

function currentKstDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replaceAll("-", "");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "공시 동기화에 실패했습니다.";
  console.error(message);
  process.exitCode = 1;
});

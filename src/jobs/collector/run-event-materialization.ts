import { z } from "zod";
import { createSupabaseDisclosureEventRepository } from "@/data/supabase-disclosure-event-repository";
import { materializeDisclosureEvents } from "@/server/materialize-disclosure-events";

const environmentSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
});

async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const disclosedOn = process.argv[2];
  const counts = await materializeDisclosureEvents(
    createSupabaseDisclosureEventRepository({
      supabaseUrl: environment.SUPABASE_URL,
      supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
    }),
    300,
    disclosedOn,
  );
  console.info(
    `공시 이벤트 변환 완료: 조회 ${counts.readCount}, 생성 ${counts.createdCount}, 갱신 ${counts.updatedCount}`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "공시 이벤트 변환에 실패했습니다.";
  console.error(message);
  process.exitCode = 1;
});

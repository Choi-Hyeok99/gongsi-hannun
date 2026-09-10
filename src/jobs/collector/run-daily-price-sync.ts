import { z } from "zod";
import { createSupabaseDailyPriceRepository } from "@/data/supabase-daily-price-repository";
import { KrxDailyPriceClient } from "@/jobs/collector/krx-daily-price-client";
import { syncDailyPrices } from "@/jobs/collector/sync-daily-prices";

const environmentSchema = z.object({
  KRX_API_KEY: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
});
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const range = readRange(process.argv.slice(2));
  const repository = createSupabaseDailyPriceRepository({
    supabaseUrl: environment.SUPABASE_URL,
    supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
  });
  const stockCodes = await repository.listActiveStockCodes();
  const counts = await syncDailyPrices(
    {
      source: new KrxDailyPriceClient({ apiKey: environment.KRX_API_KEY }),
      repository,
    },
    { ...range, stockCodes },
  );
  console.info(
    `일별 주가 동기화 완료: 읽음 ${counts.readCount}, 생성 ${counts.createdCount}, 갱신 ${counts.updatedCount}, 실패 ${counts.failedCount}`,
  );
}

function readRange(arguments_: readonly string[]): Readonly<{ from: string; to: string }> {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if ((name !== "--from" && name !== "--to") || !value || !DATE_PATTERN.test(value)) {
      throw new Error("날짜는 --from YYYY-MM-DD --to YYYY-MM-DD 형식으로 입력해 주세요.");
    }
    values.set(name, value);
  }
  if (values.size > 0 && (!values.has("--from") || !values.has("--to"))) {
    throw new Error("시작일과 종료일을 모두 입력해 주세요.");
  }
  if (values.size > 0) return { from: values.get("--from")!, to: values.get("--to")! };

  const today = koreaCalendarDate();
  const from = new Date(`${today}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: today };
}

function koreaCalendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "일별 주가 동기화에 실패했습니다.";
  console.error(message);
  process.exitCode = 1;
});

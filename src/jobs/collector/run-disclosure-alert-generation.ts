import { z } from "zod";
import { createSupabaseDisclosureAlertCandidateReader } from "@/data/supabase-disclosure-alert-candidate-reader";
import { createSupabaseDisclosureAlertRepository } from "@/data/supabase-disclosure-alert-repository";
import { generateImportantDisclosureAlerts } from "@/server/disclosure-alert-use-cases";

const environmentSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
});
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const disclosedOn = readDate(process.argv[2]);
  const options = {
    supabaseUrl: environment.SUPABASE_URL,
    supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
  };
  const candidates = await createSupabaseDisclosureAlertCandidateReader(options)
    .listByDisclosedOn(disclosedOn);
  const counts = await generateImportantDisclosureAlerts(
    { repository: createSupabaseDisclosureAlertRepository(options) },
    candidates,
  );
  console.info(
    `중요 공시 알림 생성 완료: 후보 ${counts.candidateCount}, 대상 ${counts.eligibleCount}, 생성 ${counts.createdCount}`,
  );
}

function readDate(value: string | undefined): string {
  const date = value ?? koreaCalendarDate();
  if (!DATE_PATTERN.test(date)) {
    throw new Error("날짜는 YYYY-MM-DD 형식으로 입력해 주세요.");
  }
  return date;
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
  const message = error instanceof Error ? error.message : "중요 공시 알림 생성에 실패했습니다.";
  console.error(message);
  process.exitCode = 1;
});

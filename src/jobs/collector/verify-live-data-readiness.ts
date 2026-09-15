import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { KrxDailyPriceClient } from "@/jobs/collector/krx-daily-price-client";
import { OpenDartClient } from "@/jobs/collector/open-dart-client";

const environmentSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
  OPENDART_API_KEY: z.string().regex(/^[A-Za-z0-9]{40}$/),
  KRX_API_KEY: z.string().min(1),
});

export const liveDataSchemaChecks = [
  { table: "companies", columns: "id,stock_code,market,industry_category,industry_profile_synced_at" },
  { table: "ingestion_runs", columns: "id,job_type,status,range_start,range_end,error_code" },
  { table: "source_disclosures", columns: "id,receipt_no,content_fetch_status,received_at" },
  { table: "disclosure_ingestion_observations", columns: "ingestion_run_id,source_disclosure_id,observed_at" },
  { table: "events", columns: "id,rule_importance_score,visibility" },
  { table: "disclosure_documents", columns: "id,source_disclosure_id" },
  { table: "daily_prices", columns: "id,trading_date,open_price,high_price,low_price,close_price,volume" },
  { table: "watchlist_alert_settings", columns: "user_id,company_id,minimum_importance_score" },
  { table: "in_app_notifications", columns: "id,read_at" },
  { table: "web_push_subscriptions", columns: "id,user_id,endpoint,minimum_importance_score,disabled_at" },
  { table: "web_push_deliveries", columns: "notification_id,subscription_id,status,attempt_count" },
] as const;

type CheckResult = Readonly<{ name: string; ok: boolean; detail: string }>;

async function main(): Promise<void> {
  const parsed = environmentSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => String(issue.path[0])).filter(Boolean);
    throw new Error(`환경변수 확인 필요: ${[...new Set(missing)].join(", ")}`);
  }

  const environment = parsed.data;
  const client = createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const probeDate = latestCompletedKoreaWeekday();
  const requireData = process.argv.includes("--require-data");

  const results: CheckResult[] = [];
  results.push(...await verifyDatabaseSchema(client));
  results.push(await verifyOpenDart(environment.OPENDART_API_KEY, probeDate));
  results.push(await verifyKrx(environment.KRX_API_KEY, probeDate));
  results.push(...await verifyStoredData(client, requireData));

  for (const result of results) {
    console.info(`${result.ok ? "PASS" : "FAIL"}  ${result.name} — ${result.detail}`);
  }
  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) throw new Error(`실데이터 준비 점검 실패: ${failed.length}개 항목`);
  console.info("실데이터 연결 사전점검을 통과했습니다. 비밀값은 출력하지 않았습니다.");
}

async function verifyDatabaseSchema(client: SupabaseClient): Promise<readonly CheckResult[]> {
  return Promise.all(liveDataSchemaChecks.map(async ({ table, columns }) => {
    const { error } = await client.from(table).select(columns, { head: true, count: "exact" });
    return error
      ? { name: `Supabase ${table}`, ok: false, detail: "테이블 또는 최신 migration 열을 확인하세요." }
      : { name: `Supabase ${table}`, ok: true, detail: "스키마 확인 완료" };
  }));
}

async function verifyStoredData(client: SupabaseClient, requireData: boolean): Promise<readonly CheckResult[]> {
  const [companies, disclosures, prices] = await Promise.all([
    client.from("companies").select("id", { head: true, count: "exact" }).eq("is_active", true),
    client.from("source_disclosures").select("id", { head: true, count: "exact" }),
    client.from("daily_prices").select("id", { head: true, count: "exact" }),
  ]);
  const targets = [
    { label: "활성 기업", result: companies },
    { label: "공시", result: disclosures },
    { label: "일별 주가", result: prices },
  ] as const;
  return targets.map(({ label, result }) => {
    const { count, error } = result;
    if (error) return { name: `${label} 데이터`, ok: false, detail: "행 개수를 확인하지 못했습니다." };
    const value = count ?? 0;
    return {
      name: `${label} 데이터`,
      ok: !requireData || value > 0,
      detail: value > 0 ? `${value.toLocaleString("ko-KR")}건 저장됨` : requireData ? "저장된 데이터 없음" : "0건 (최초 수집 전 허용)",
    };
  });
}

async function verifyOpenDart(apiKey: string, date: string): Promise<CheckResult> {
  try {
    await new OpenDartClient({ apiKey }).fetchPage({ fromDate: compactDate(date), toDate: compactDate(date), page: 1 });
    return { name: "OpenDART API", ok: true, detail: "인증 및 응답 형식 확인 완료" };
  } catch {
    return { name: "OpenDART API", ok: false, detail: "API 키, 한도 또는 서비스 상태를 확인하세요." };
  }
}

async function verifyKrx(apiKey: string, date: string): Promise<CheckResult> {
  try {
    await new KrxDailyPriceClient({ apiKey }).fetchDailyPrices({ from: date, to: date, stockCodes: ["005930"] });
    return { name: "KRX API", ok: true, detail: `KOSPI·KOSDAQ·KONEX 승인 확인 완료 (${date})` };
  } catch {
    return { name: "KRX API", ok: false, detail: "인증키와 세 시장의 일별매매정보 승인을 확인하세요." };
  }
}

export function latestCompletedKoreaWeekday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = `${values.year}-${values.month}-${values.day}`;
  const candidate = new Date(`${today}T00:00:00.000Z`);
  if (Number(values.hour) < 19) candidate.setUTCDate(candidate.getUTCDate() - 1);
  while (candidate.getUTCDay() === 0 || candidate.getUTCDay() === 6) candidate.setUTCDate(candidate.getUTCDate() - 1);
  return candidate.toISOString().slice(0, 10);
}

function compactDate(value: string): string { return value.replaceAll("-", ""); }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "실데이터 준비 상태를 확인하지 못했습니다.");
    process.exitCode = 1;
  });
}

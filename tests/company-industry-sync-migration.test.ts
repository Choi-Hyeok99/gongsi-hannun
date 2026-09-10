import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "202609100005_add_company_industry_sync.sql",
);
const previousMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "202609100001_add_daily_prices.sql",
);

describe("company industry sync migration", () => {
  it("preserves every ingestion job type allowed by the previous constraint", async () => {
    const previousTypes = extractAllowedJobTypes(await readFile(previousMigrationPath, "utf8"));
    const currentTypes = extractAllowedJobTypes(await readFile(migrationPath, "utf8"));
    expect(currentTypes).toEqual(expect.arrayContaining([...previousTypes]));
  });

  it("adds the company industry ingestion job type", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("'COMPANY_INDUSTRY_SYNC'");
  });
});

function extractAllowedJobTypes(sql: string): readonly string[] {
  const values = sql.match(/job_type\s+in\s*\(([^)]+)\)/i)?.[1] ?? "";
  return [...values.matchAll(/'([A-Z_]+)'/g)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));
}

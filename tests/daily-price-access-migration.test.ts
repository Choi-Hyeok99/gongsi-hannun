import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "202609100004_allow_public_daily_price_reads.sql",
);

describe("public daily-price access migration", () => {
  it("grants read access to public roles behind a select-only RLS policy", async () => {
    const sql = (await readFile(migrationPath, "utf8")).replaceAll(/\s+/g, " ").toLowerCase();

    expect(sql).toContain("grant select on table public.daily_prices to anon, authenticated");
    expect(sql).toContain("create policy daily_prices_public_read on public.daily_prices for select to anon, authenticated using (true)");
  });

  it("explicitly keeps mutation privileges away from public roles", async () => {
    const sql = (await readFile(migrationPath, "utf8")).replaceAll(/\s+/g, " ").toLowerCase();

    expect(sql).toContain("revoke insert, update, delete, truncate, references, trigger on table public.daily_prices from anon, authenticated");
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)/);
  });
});

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("company listing status migration", () => {
  it("removes OpenDART OTHER corporations from active listed results", async () => {
    const sql = await readFile(join(
      process.cwd(),
      "supabase",
      "migrations",
      "202609250001_hide_non_listed_companies.sql",
    ), "utf8");

    expect(sql).toContain("where market = 'OTHER'");
    expect(sql).toContain("is_listed = false");
    expect(sql).toContain("is_active = false");
  });
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("KRX no-trade daily price migration", () => {
  it("allows only the official zero-intraday no-trade shape", async () => {
    const sql = await readFile(
      new URL("../supabase/migrations/202609100006_allow_krx_no_trade_prices.sql", import.meta.url),
      "utf8",
    );
    expect(sql).toContain("volume = 0");
    expect(sql).toContain("open_price = 0");
    expect(sql).toContain("high_price = 0");
    expect(sql).toContain("low_price = 0");
    expect(sql).toContain("open_price > 0");
    expect(sql).toContain("low_price > 0");
  });
});

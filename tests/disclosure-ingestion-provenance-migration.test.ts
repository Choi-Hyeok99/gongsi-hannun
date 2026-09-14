import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/202609140001_add_disclosure_ingestion_provenance.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("disclosure ingestion provenance migration", () => {
  it("records each disclosure observed by a collection run", () => {
    expect(migration).toContain("create table public.disclosure_ingestion_observations");
    expect(migration).toContain("primary key (ingestion_run_id, source_disclosure_id)");
    expect(migration).toContain("observed_at timestamptz not null");
  });

  it("keeps operational provenance server-only", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("revoke all on table public.disclosure_ingestion_observations from public, anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete on table public.disclosure_ingestion_observations to service_role");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/202609100003_add_disclosure_documents.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("disclosure document migration", () => {
  it("keeps extracted filing text behind server-only database access", () => {
    expect(migration).toContain("create table public.disclosure_documents");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("revoke all on table public.disclosure_documents from public, anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete on table public.disclosure_documents to service_role");
  });

  it("limits filenames, content size, states, and duplicate documents", () => {
    expect(migration).toContain("content_fetch_status in ('pending', 'fetching', 'ready', 'unavailable', 'failed')");
    expect(migration).toContain("octet_length(content_text) <= 8388608");
    expect(migration).toContain("and file_name !~");
    expect(migration).toContain("unique (source_disclosure_id, file_name)");
  });
});

import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const sql=readFileSync(new URL("../supabase/migrations/202610130001_add_on_demand_ai_guard.sql",import.meta.url),"utf8");
describe("global free-AI safety guard",()=>{
  it("atomically locks one shared row, with expiry and daily Pacific budget",()=>{
    expect(sql).toContain("for update");expect(sql).toContain("America/Los_Angeles");expect(sql).toContain("slot.calls >= 100");expect(sql).toContain("interval '90 seconds'");expect(sql).toContain("interval '10 seconds'");expect(sql).toContain("lease_token = p_token");
  });
  it("exposes the control functions only to the service role, never browsers",()=>{
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on function public.acquire_on_demand_ai_slot() from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.acquire_on_demand_ai_slot() to service_role");
    expect(sql).toContain("security definer set search_path = ''");
    expect(sql).not.toMatch(/user_id|ip_address|email|content_text/);
  });
});

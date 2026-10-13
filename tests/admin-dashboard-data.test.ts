import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({from:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/server/account",()=>({createSupabaseAdminClient:()=>({from:mocks.from})}));
vi.mock("@/server/cloudflare-admin-metrics",()=>({readCloudflareAdminMetrics:async()=>({worker:{status:"NOT_CONFIGURED",requests:null,errors:null},traffic:{status:"NOT_CONFIGURED",days:[]}})}));
import {readAdminDashboard} from "@/server/admin-dashboard";
function builder(result:unknown) {
  const query:Record<string,unknown>={};
  for(const method of ["select","eq","neq","contains","gte","order","limit","is","maybeSingle"]) query[method]=()=>query;
  query.then=(resolve:(value:unknown)=>unknown,reject:(reason:unknown)=>unknown)=>Promise.resolve(result).then(resolve,reject);
  return query;
}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-14T03:00:00Z"));vi.stubEnv("GEMINI_ON_DEMAND_MODEL","gemini-3.1-flash-lite");});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
describe("real-data dashboard semantics",()=>{
  it("keeps database query failures unknown and invoices unconnected",async()=>{
    mocks.from.mockImplementation(()=>builder({error:{message:"private DB error"},count:null,data:null}));
    const data=await readAdminDashboard();expect(data.counts.members).toBeNull();expect(data.quota.calls).toBeNull();expect(data.usage.inputTokens).toBeNull();expect(data.invoices.gemini).toBeNull();expect(data.usage.paidEquivalentUsd).toBeNull();expect(JSON.stringify(data)).not.toContain("private DB");
  });
  it("reads aggregate source records without selecting member email or summary text",async()=>{
    mocks.from.mockImplementation((table:string)=>builder(table==="ai_on_demand_guard" ? {error:null,data:{quota_day:"2026-10-12",calls:98,blocked_until:null}} : table==="ingestion_runs" ? {error:null,count:0,data:[]} : table==="ai_analyses" ? {error:null,count:4,data:[]} : {error:null,count:7,data:[]}));
    const data=await readAdminDashboard();expect(data.counts.members).toBe(7);expect(data.quota.calls).toBe(0);expect(data.usage.attempts).toBe(0);expect(data.invoices.cloudflare).toBeNull();
    expect(data.cloudflare.worker.requests).toBeNull();expect(data.usage.days).toHaveLength(7);
  });
});

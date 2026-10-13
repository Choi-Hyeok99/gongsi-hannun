import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {readCloudflareAdminMetrics} from "@/server/cloudflare-admin-metrics";
const env={CLOUDFLARE_ANALYTICS_API_TOKEN:"never-print-this-test-token",CLOUDFLARE_ANALYTICS_ACCOUNT_ID:"a".repeat(32),CLOUDFLARE_ANALYTICS_ZONE_ID:"b".repeat(32)};
describe("Cloudflare read-only aggregate metrics",()=>{
  it("needs no calls without a read-only token and returns unknown, not fake zero",async()=>{
    const fetcher=vi.fn();const data=await readCloudflareAdminMetrics({},fetcher);expect(fetcher).not.toHaveBeenCalled();expect(data.worker.requests).toBeNull();expect(data.traffic.status).toBe("NOT_CONFIGURED");
  });
  it("keeps zone traffic separate from Worker requests and never returns credentials",async()=>{
    const fetcher=vi.fn(async(_input:unknown,options?:RequestInit)=>{
      expect(String(_input)).not.toContain(env.CLOUDFLARE_ANALYTICS_API_TOKEN);
      expect(new Headers(options?.headers).get("Authorization")).toBe(`Bearer ${env.CLOUDFLARE_ANALYTICS_API_TOKEN}`);
      const body=JSON.parse(String(options?.body));
      expect(body.query).toContain(": string!");
      expect(body.query).not.toMatch(/: (String|Date)!/);
      const viewer=body.query.includes("workersInvocationsAdaptive") ? {accounts:[{workersInvocationsAdaptive:[{sum:{requests:120,errors:2}}]}]} : {zones:[{httpRequests1dGroups:[{dimensions:{date:"2026-10-14"},uniq:{uniques:8},sum:{pageViews:15,requests:90}}]}]};
      return new Response(JSON.stringify({data:{viewer},errors:null}));
    });
    const data=await readCloudflareAdminMetrics(env,fetcher,new Date("2026-10-14T03:00:00Z"));expect(data.worker.requests).toBe(120);expect(data.traffic.days[0]?.uniqueIps).toBe(8);expect(JSON.stringify(data)).not.toContain("never-print");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([401,403,429,500])("contains HTTP %s failures without exposing raw errors",async status=>{
    const data=await readCloudflareAdminMetrics(env,async()=>new Response("private provider message",{status}));expect(data.worker.status).toBe("UNAVAILABLE");expect(data.worker.requests).toBeNull();expect(JSON.stringify(data)).not.toContain("private");
  });
  it("does not call an empty account zero when API scope is wrong",async()=>{
    const data=await readCloudflareAdminMetrics(env,async()=>new Response(JSON.stringify({data:{viewer:{accounts:[],zones:[]}}})));expect(data.worker.status).toBe("UNAVAILABLE");expect(data.traffic.status).toBe("UNAVAILABLE");
  });
  it("does not confuse an absent dataset with a verified empty dataset",async()=>{
    const data=await readCloudflareAdminMetrics(env,async()=>new Response(JSON.stringify({data:{viewer:{accounts:[{}],zones:[{}]}}})));
    expect(data.worker.requests).toBeNull();expect(data.traffic.status).toBe("UNAVAILABLE");
  });
  it("fails independently per provider dataset",async()=>{
    const data=await readCloudflareAdminMetrics(env,async(_url,options)=>{
      const worker=JSON.parse(String(options?.body)).query.includes("workersInvocationsAdaptive");
      return new Response(JSON.stringify(worker ? {data:{viewer:{accounts:[{workersInvocationsAdaptive:[]}]}}} : {errors:[{message:"plan permission detail"}]}));
    });expect(data.worker.requests).toBe(0);expect(data.traffic.status).toBe("UNAVAILABLE");expect(JSON.stringify(data)).not.toContain("permission detail");
  });
  it("classifies invalid tokens without returning or logging provider messages",async()=>{
    const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
    const data=await readCloudflareAdminMetrics(env,async()=>new Response(JSON.stringify({errors:[{message:"Authentication error with private-token"}]})));
    expect(data.worker.reason).toBe("AUTH");expect(JSON.stringify(data)).not.toContain("private-token");expect(JSON.stringify(warn.mock.calls)).not.toContain("private-token");warn.mockRestore();
  });
});

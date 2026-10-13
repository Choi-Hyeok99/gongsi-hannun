import "server-only";
import { nonNegativeCount } from "@/domain/admin-metrics";

export type MetricConnection = "CONNECTED" | "NOT_CONFIGURED" | "UNAVAILABLE";
export type TrafficDay = Readonly<{date:string;uniqueIps:number|null;pageViews:number|null;requests:number|null}>;
export type CloudflareAdminMetrics = Readonly<{
  worker: {status:MetricConnection;requests:number|null;errors:number|null};
  traffic: {status:MetricConnection;days:readonly TrafficDay[]};
}>;
type Env = Readonly<Record<string,string|undefined>>;
const ID = /^[0-9a-f]{32}$/i;
const workerQuery = `query Worker($account: String!, $script: String!, $start: Time!, $end: Time!) {
  viewer { accounts(filter:{accountTag:$account}) {
    workersInvocationsAdaptive(limit:1, filter:{scriptName:$script,datetime_geq:$start,datetime_leq:$end}) {sum {requests errors}}
  }}
}`;
const trafficQuery = `query Traffic($zone: String!, $start: Date!, $end: Date!) {
  viewer { zones(filter:{zoneTag:$zone}) {
    httpRequests1dGroups(limit:7,orderBy:[date_ASC],filter:{date_geq:$start,date_leq:$end}) {
      dimensions {date} uniq {uniques} sum {pageViews requests}
    }
  }}
}`;
type Json = Record<string, unknown>;
function obj(value: unknown): Json { return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {}; }
function rows(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
async function query(fetchImpl: typeof fetch, token: string, query: string, variables: Json): Promise<Json> {
  const response = await fetchImpl("https://api.cloudflare.com/client/v4/graphql",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
    body:JSON.stringify({query,variables}),cache:"no-store",signal:AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("ANALYTICS_UNAVAILABLE");
  const body = obj(await response.json());
  if (rows(body.errors).length || !body.data) throw new Error("ANALYTICS_UNAVAILABLE");
  return obj(obj(body.data).viewer);
}
export async function readCloudflareAdminMetrics(
  env: Env = process.env, fetchImpl: typeof fetch = fetch, now = new Date(),
): Promise<CloudflareAdminMetrics> {
  const token = env.CLOUDFLARE_ANALYTICS_API_TOKEN?.trim();
  const account = env.CLOUDFLARE_ANALYTICS_ACCOUNT_ID?.trim();
  const zone = env.CLOUDFLARE_ANALYTICS_ZONE_ID?.trim();
  const script = env.CLOUDFLARE_ANALYTICS_WORKER_NAME?.trim() || "gongsi-hannun";
  const worker: CloudflareAdminMetrics["worker"] = {status:"NOT_CONFIGURED",requests:null,errors:null};
  const traffic: CloudflareAdminMetrics["traffic"] = {status:"NOT_CONFIGURED",days:[]};
  if (!token) return {worker,traffic};
  const [workerResult,trafficResult] = await Promise.all([
    account && ID.test(account) && /^[a-z0-9_-]{1,63}$/.test(script) ? (async () => {
      try {
        const viewer = await query(fetchImpl,token,workerQuery,{account,script,start:new Date(now.getTime()-86_400_000).toISOString(),end:now.toISOString()});
        const accounts = rows(viewer.accounts);
        if (!accounts.length) throw new Error("ANALYTICS_UNAVAILABLE");
        const dataset = obj(accounts[0]).workersInvocationsAdaptive;
        if (!Array.isArray(dataset)) throw new Error("ANALYTICS_UNAVAILABLE");
        const groups = rows(dataset);
        if (!groups.length) return {status:"CONNECTED" as const,requests:0,errors:0};
        const sum = obj(obj(groups[0]).sum);
        const requests = nonNegativeCount(sum.requests), errors = nonNegativeCount(sum.errors);
        if (requests === null || errors === null) throw new Error("ANALYTICS_UNAVAILABLE");
        return {status:"CONNECTED" as const,requests,errors};
      } catch { return {...worker,status:"UNAVAILABLE" as const}; }
    })() : Promise.resolve(worker),
    zone && ID.test(zone) ? (async () => {
      try {
        const viewer = await query(fetchImpl,token,trafficQuery,{zone,start:new Date(now.getTime()-6*86_400_000).toISOString().slice(0,10),end:now.toISOString().slice(0,10)});
        const zones = rows(viewer.zones);
        if (!zones.length) throw new Error("ANALYTICS_UNAVAILABLE");
        const dataset = obj(zones[0]).httpRequests1dGroups;
        if (!Array.isArray(dataset)) throw new Error("ANALYTICS_UNAVAILABLE");
        const days = rows(dataset).map(group => {
          const row = obj(group), sum = obj(row.sum);
          return {date:String(obj(row.dimensions).date ?? ""),uniqueIps:nonNegativeCount(obj(row.uniq).uniques),pageViews:nonNegativeCount(sum.pageViews),requests:nonNegativeCount(sum.requests)};
        });
        if (days.some(day=>!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || day.uniqueIps === null || day.pageViews === null || day.requests === null)) throw new Error("ANALYTICS_UNAVAILABLE");
        return {status:"CONNECTED" as const,days};
      } catch { return {...traffic,status:"UNAVAILABLE" as const}; }
    })() : Promise.resolve(traffic),
  ]);
  return {worker:workerResult,traffic:trafficResult};
}

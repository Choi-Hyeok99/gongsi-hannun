import "server-only";
import { createSupabaseAdminClient } from "@/server/account";
import { AI_USAGE_SOURCE, currentGuardCalls, nonNegativeCount, paidEquivalentUsd, seoulDayStart } from "@/domain/admin-metrics";
import { readCloudflareAdminMetrics } from "@/server/cloudflare-admin-metrics";
import { readOnDemandAiModel } from "@/server/on-demand-ai-env";

export async function readAdminDashboard() {
  const now = new Date();
  const since = seoulDayStart(now,6);
  const client = createSupabaseAdminClient();
  const [members,watchlist,push,publicEvents,success,failed,todaySuccess,guard,usage,errors,collectors,cloudflare] = await Promise.all([
    client.from("profiles").select("user_id",{count:"exact",head:true}),
    client.from("watchlist_companies").select("company_id",{count:"exact",head:true}),
    client.from("web_push_subscriptions").select("id",{count:"exact",head:true}).is("disabled_at",null),
    client.from("events").select("id",{count:"exact",head:true}).eq("visibility","PUBLIC"),
    client.from("ai_analyses").select("id",{count:"exact",head:true}).eq("status","SUCCEEDED"),
    client.from("ai_analyses").select("id",{count:"exact",head:true}).eq("status","FAILED"),
    client.from("ai_analyses").select("id",{count:"exact",head:true}).eq("status","SUCCEEDED").gte("generated_at",seoulDayStart(now)),
    client.from("ai_on_demand_guard").select("quota_day,calls,blocked_until").eq("id",true).maybeSingle(),
    client.from("ingestion_runs").select("started_at,status,metadata",{count:"exact"}).eq("job_type","AI_ANALYZE").contains("metadata",{source:AI_USAGE_SOURCE}).gte("started_at",since).order("started_at",{ascending:false}).limit(1000),
    client.from("ai_analyses").select("error_code,updated_at").eq("status","FAILED").order("updated_at",{ascending:false}).limit(8),
    client.from("ingestion_runs").select("job_type,status,finished_at,failed_count").neq("job_type","AI_ANALYZE").order("started_at",{ascending:false}).limit(8),
    readCloudflareAdminMetrics(),
  ]);
  const count = (result: {error:unknown;count:number|null}) => result.error ? null : nonNegativeCount(result.count);
  const measurements = usage.error ? null : usage.data;
  const truncated = !usage.error && (usage.count ?? 0) > 1000;
  const rows = measurements ?? [];
  let input = 0, output = 0, equivalent = 0, missing = 0, unknownPrice = false;
  for (const row of rows) {
    const metadata = row.metadata as Record<string,unknown>;
    const inputTokens = nonNegativeCount(metadata.inputTokens);
    const outputTokens = nonNegativeCount(metadata.outputTokens);
    if (inputTokens === null || outputTokens === null) { missing++; continue; }
    input += inputTokens; output += outputTokens;
    const amount = paidEquivalentUsd(String(metadata.model),inputTokens,outputTokens);
    if (amount === null) unknownPrice = true;
    else equivalent += amount;
  }
  const days = Array.from({length:7},(_,index)=>{
    const day = seoulDayStart(now,6-index);
    const date = new Date(new Date(day).getTime()+9*3_600_000).toISOString().slice(0,10);
    const dayRows = rows.filter(row=>new Date(new Date(row.started_at).getTime()+9*3_600_000).toISOString().slice(0,10)===date);
    return {date,attempts:measurements && !truncated ? dayRows.length : null,
      successes:measurements && !truncated ? dayRows.filter(row=>row.status==="SUCCEEDED").length : null};
  });
  return {
    updatedAt:now.toISOString(),model:readOnDemandAiModel(),
    counts:{members:count(members),watchlist:count(watchlist),push:count(push),
      publicEvents:count(publicEvents),summaries:count(success),failedAnalyses:count(failed),todaySummaries:count(todaySuccess)},
    quota:{available:!guard.error && Boolean(guard.data),calls:guard.error || !guard.data ? null : currentGuardCalls(guard.data.quota_day,guard.data.calls,now),
      limit:100,timeZone:"America/Los_Angeles",blockedUntil:guard.error ? null : guard.data?.blocked_until ?? null},
    usage:{since,available:measurements !== null,truncated,attempts:count(usage),
      inputTokens:measurements && !truncated ? input : null,outputTokens:measurements && !truncated ? output : null,
      unmeasuredCalls:measurements && !truncated ? missing : null,
      paidEquivalentUsd:measurements && !truncated && !unknownPrice ? equivalent : null,days},
    // No email, auth identifiers, source text, keys or provider error messages.
    recentErrors:errors.error ? null : errors.data.map(row=>({code:/^AI_[A-Z_]{1,50}$/.test(row.error_code ?? "") ? row.error_code : "AI_UPSTREAM_ERROR",at:row.updated_at})),
    collectors:collectors.error ? null : collectors.data,
    cloudflare,
    invoices:{cloudflare:null,gemini:null,supabase:null},
  };
}
export type AdminDashboard = Awaited<ReturnType<typeof readAdminDashboard>>;

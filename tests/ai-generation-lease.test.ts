import {describe,expect,it} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {SupabaseAiAnalysisRepository} from "@/data/supabase-ai-analysis-repository";
import {isRetryableAiAnalysis} from "@/domain/ai-analysis-retry";
import type {AiAnalysisCandidate} from "@/domain/ai-disclosure-summary";
const candidate={eventId:"event",inputHash:"a".repeat(64)} as AiAnalysisCandidate;
function database(initial:Record<string,unknown>|null=null) {
  let row=initial;
  const client={from:()=>{
    let update:Record<string,unknown>|undefined;const filters:((row:Record<string,unknown>)=>boolean)[]=[];
    const query={
      insert:async(value:Record<string,unknown>)=>{if(row)return {error:{code:"23505"}};row={id:"analysis",...value};return {error:null};},
      select:()=>query,update:(value:Record<string,unknown>)=>{update=value;return query;},
      eq:(key:string,value:unknown)=>{filters.push(row=>row[key]===value);return query;},
      lte:(key:string,value:string)=>{filters.push(row=>String(row[key])<=value);return query;},
      maybeSingle:async()=>{if(!row || filters.some(test=>!test(row!)))return {data:null,error:null};if(update)row={...row,...update};return {data:{...row},error:null};},
      then:(resolve:(value:unknown)=>unknown)=>query.maybeSingle().then(resolve),
    };return query;
  }} as unknown as SupabaseClient;
  return {client,current:()=>row};
}
describe("generation event leases",()=>{
  it("allows only one simultaneous event generation",async()=>{
    const db=database();const first=new SupabaseAiAnalysisRepository(db.client);const second=new SupabaseAiAnalysisRepository(db.client);
    expect(await Promise.all([first.begin(candidate,"v4"),second.begin(candidate,"v4")])).toEqual([true,false]);
  });
  it("recovers a stale lease but never overwrites successful results",async()=>{
    const stale={id:"analysis",event_id:"event",analysis_version:"v4",status:"PROCESSING",attempt_count:1,locked_at:"2026-01-01T00:00:00Z",lease_expires_at:"2026-01-01T00:05:00Z"};
    const db=database(stale);expect(await new SupabaseAiAnalysisRepository(db.client).begin(candidate,"v4")).toBe(true);
    expect(db.current()?.attempt_count).toBe(2);
    const succeeded=database({...stale,status:"SUCCEEDED"});expect(await new SupabaseAiAnalysisRepository(succeeded.client).begin(candidate,"v4")).toBe(false);
  });
  it("a stale owner cannot publish after its lock was replaced",async()=>{
    const db=database();const owner=new SupabaseAiAnalysisRepository(db.client);await owner.begin(candidate,"v4");
    db.current()!.locked_at="replacement-owner";
    await expect(owner.complete("event","v4",{providerName:"google",modelName:"free",summarize:async()=>{throw new Error();}},{plainSummary:"old",whyItMatters:"",checkpoints:[],cautions:[],importanceScore:1,verifiedFacts:[]})).rejects.toThrow("AI 분석 결과를 저장하지 못했습니다");
    expect(db.current()?.status).toBe("PROCESSING");
  });
  it("does not reclaim active or malformed leases",()=>{
    expect(isRetryableAiAnalysis({status:"PROCESSING",attemptCount:1,errorCode:"",leaseExpiresAt:new Date(Date.now()+100_000).toISOString()})).toBe(false);
    expect(isRetryableAiAnalysis({status:"PROCESSING",attemptCount:1,errorCode:"",leaseExpiresAt:"invalid"})).toBe(false);
    expect(isRetryableAiAnalysis({status:"PENDING",attemptCount:0,errorCode:""})).toBe(true);
  });
});

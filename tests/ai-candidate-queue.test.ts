import {describe,expect,it} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {SupabaseAiAnalysisRepository} from "@/data/supabase-ai-analysis-repository";

function event(index:number) {
  return {id:`event-${index}`,event_type:index%2 ? "M_AND_A" : "OTHER",rule_importance_score:50,source_disclosures:{receipt_no:`20261013${String(index).padStart(6,"0")}`,report_name:"기업 공시",disclosed_on:`2026-09-${String(index).padStart(2,"0")}`,companies:{name_ko:"상장기업"},disclosure_documents:[{id:`doc-${index}`,title:"공시",document_kind:"MAIN",sequence_no:1,content_text:"합병기일 2026-12-01",content_hash:"a".repeat(64)}]}};
}
function client(count:number,published:string[]=[]) {
  const events=Array.from({length:count},(_,index)=>event(index+1));
  return {from:(table:string)=>{
    let oldest=false;
    const query={select:()=>query,eq:()=>query,in:()=>table==="ai_analyses" ? Promise.resolve({data:published.map(event_id=>({event_id,analysis_version:"v2",status:"SUCCEEDED",attempt_count:1,error_code:null})),error:null}) : query,
      order:(field:string,options:{ascending:boolean})=>{if(field==="occurred_on")oldest=options.ascending;return query;},
      range:async(start:number,end:number)=>({data:(oldest?events:[...events].reverse()).slice(start,end+1),error:null})};
    return query;
  }} as unknown as SupabaseClient;
}
describe("all-type AI candidate queue",()=>{
  it("reserves a quarter of each batch for oldest waiting disclosures",async()=>{
    const rows=await new SupabaseAiAnalysisRepository(client(20),true).findCandidates(8,"v4");
    expect(rows.map(row=>row.eventId)).toEqual(["event-20","event-19","event-18","event-17","event-16","event-15","event-1","event-2"]);
  });
  it("never duplicates an event or regenerates a successful older-version summary",async()=>{
    const rows=await new SupabaseAiAnalysisRepository(client(3,["event-2"]),true).findCandidates(8,"v4");
    expect(rows.map(row=>row.eventId)).toEqual(["event-3","event-1"]);
  });
});

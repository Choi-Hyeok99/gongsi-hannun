import {describe,expect,it,vi} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {recordAiUsage} from "@/data/ai-usage-recorder";
describe("private usage records",()=>{
  it("writes only bounded operational metadata through the server client",async()=>{
    const insert=vi.fn(()=>({abortSignal:vi.fn().mockResolvedValue({error:null})}));
    const client={from:vi.fn(()=>({insert}))} as unknown as SupabaseClient;
    await recordAiUsage(client,{model:"gemini-3.1-flash-lite",succeeded:true,errorCode:null,inputTokens:100,outputTokens:40,totalTokens:140,startedAt:"2026-10-14T00:00:00Z",finishedAt:"2026-10-14T00:00:01Z"});
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({job_type:"AI_ANALYZE",status:"SUCCEEDED",read_count:1,metadata:{source:"ADMIN_AI_USAGE_V1",model:"gemini-3.1-flash-lite",inputTokens:100,outputTokens:40,totalTokens:140}}));
    expect(JSON.stringify(insert.mock.calls)).not.toMatch(/email|receipt|contentText|apiKey/);
  });
  it("reports storage failure using a fixed safe error",async()=>{
    const client={from:()=>({insert:()=>({abortSignal:async()=>({error:{message:"private secret"}})})})} as unknown as SupabaseClient;
    await expect(recordAiUsage(client,{model:"gemini-3.1-flash-lite",succeeded:false,errorCode:"AI_TIMEOUT",inputTokens:null,outputTokens:null,totalTokens:null,startedAt:"2026-10-14T00:00:00Z",finishedAt:"2026-10-14T00:01:00Z"})).rejects.toThrow("AI_USAGE_RECORD_UNAVAILABLE");
  });
});

import {describe,expect,it,vi} from "vitest";
import {MeasuredGeminiProvider} from "@/jobs/analyzer/measured-gemini-provider";
import type {AiAnalysisCandidate} from "@/domain/ai-disclosure-summary";
const candidate:AiAnalysisCandidate={eventId:"e",receiptNumber:"20261013000001",companyName:"테스트기업",reportName:"계약",disclosedOn:"2026-10-13",eventType:"SUPPLY_CONTRACT",ruleImportanceScore:70,contentText:"계약금액 100억원",inputHash:"a".repeat(64),sourceDocument:{id:"d",title:"공시",kind:"MAIN",contentHash:"b".repeat(64)}};
const summary={plainSummary:"회사가 계약을 체결했습니다.",whyItMatters:"계약 내용을 확인하세요.",checkpoints:["원문 확인"],cautions:["투자 판단에 유의하세요."],importanceScore:70,factCandidates:[]};
const successful:typeof fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(summary)}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:25,totalTokenCount:140}}));
describe("actual generation metering",()=>{
  it("leaves incomplete provider usage unknown instead of inventing zero tokens",async()=>{
    const record=vi.fn().mockResolvedValue(undefined);
    const provider=new MeasuredGeminiProvider({apiKey:"test-secret",fetchImpl:async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(summary)}]}}],usageMetadata:{candidatesTokenCount:25}}))},record);
    await provider.summarize(candidate);expect(record).toHaveBeenCalledWith(expect.objectContaining({inputTokens:null,outputTokens:null,totalTokens:null}));
  });
  it("records actual returned tokens, including non-candidate output, without personal/source content",async()=>{
    const record=vi.fn().mockResolvedValue(undefined);const provider=new MeasuredGeminiProvider({apiKey:"test-secret",model:"gemini-3.1-flash-lite",fetchImpl:successful},record);
    await expect(provider.summarize(candidate)).resolves.toEqual(summary);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({succeeded:true,inputTokens:100,outputTokens:40,totalTokens:140}));
    const stored=JSON.stringify(record.mock.calls);expect(stored).not.toContain(candidate.receiptNumber);expect(stored).not.toContain(candidate.companyName);expect(stored).not.toContain("test-secret");
  });
  it("records classified failures and leaves missing tokens unknown",async()=>{
    const record=vi.fn().mockResolvedValue(undefined);const provider=new MeasuredGeminiProvider({apiKey:"test-secret",fetchImpl:async()=>new Response("upstream private content",{status:503})},record);
    await expect(provider.summarize(candidate)).rejects.toThrow("AI_PROVIDER_UNAVAILABLE");expect(record).toHaveBeenCalledWith(expect.objectContaining({succeeded:false,errorCode:"AI_PROVIDER_UNAVAILABLE",inputTokens:null,outputTokens:null}));expect(JSON.stringify(record.mock.calls)).not.toContain("private");
  });
  it("does not fail a valid summary when telemetry storage fails",async()=>{
    const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});const provider=new MeasuredGeminiProvider({apiKey:"test-secret",fetchImpl:successful},async()=>{throw new Error("private DB key");});
    await expect(provider.summarize(candidate)).resolves.toEqual(summary);expect(warn).toHaveBeenCalledWith("AI_USAGE_RECORD_UNAVAILABLE");warn.mockRestore();
  });
});

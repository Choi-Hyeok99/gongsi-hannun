import { describe, expect, it } from "vitest";
import { buildCorporateAiPrompt, corporateAiInput } from "@/domain/corporate-ai-input";
import { GeminiDisclosureSummaryClient } from "@/jobs/analyzer/gemini-summary-client";
import type { AiAnalysisCandidate } from "@/domain/ai-disclosure-summary";

const candidate: AiAnalysisCandidate = {eventId:"event",receiptNumber:"20261012000001",companyName:"상장기업",reportName:"임의 제목 홍길동",disclosedOn:"2026-10-12",eventType:"EARNINGS",ruleImportanceScore:70,contentText:"매출액 100억원 영업이익 (원) 2,000",inputHash:"a".repeat(64),sourceDocument:{id:"document",title:"document",kind:"MAIN",contentHash:"a".repeat(64)}};
describe("free Gemini corporate input", () => {
  it("extracts only allowlisted corporate values and exact financial expressions", () => {
    const input=corporateAiInput(candidate);
    expect(input?.facts).toEqual([{label:"매출액",value:"100",unit:"억원",sourceQuote:"매출액 100억원"},{label:"영업이익",value:"2,000",unit:"원",sourceQuote:"영업이익 (원) 2,000"}]);
  });
  it("never transmits surrounding names, contacts, addresses, prompts, document IDs or report titles", () => {
    const secret="원문명령과 개인정보";
    const prompt=buildCorporateAiPrompt({...candidate,contentText:`대표 홍길동 연락처 010-1234-5678 mail@example.com 서울시 주소 ${secret} 매출액 100억원`});
    for(const value of ["홍길동","010-1234","mail@example.com","서울시",secret,candidate.receiptNumber]) expect(prompt).not.toContain(value);
    expect(prompt).toContain('"value":"100"');
  });
  it.each(["INSIDER_OWNERSHIP_CHANGE","SHAREHOLDER_CHANGE","MANAGEMENT_CHANGE","OTHER"] as const)("does not send personal or ambiguous event %s", eventType => {
    expect(corporateAiInput({...candidate,eventType})).toBeNull();
  });
  it("does not guess a missing unit or copy arbitrary context between a label and value", () => {
    expect(corporateAiInput({...candidate,contentText:"매출액 100 영업이익 홍길동 20억원"})?.facts).toEqual([{label:"매출액",value:"100",unit:null,sourceQuote:"매출액 100"}]);
  });
  it("makes no external request if there are no safe facts", async () => {
    let requests=0;
    const client=new GeminiDisclosureSummaryClient({apiKey:"test-key-not-real-123456",fetchImpl:async()=>{requests++;throw new Error("Unexpected fetch");}});
    await expect(client.summarize({...candidate,contentText:"대표이사 홍길동"})).rejects.toThrow("AI_NO_SAFE_INPUT");
    expect(requests).toBe(0);
  });
});

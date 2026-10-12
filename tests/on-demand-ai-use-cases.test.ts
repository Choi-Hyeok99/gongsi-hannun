import {beforeEach,describe,expect,it,vi} from "vitest";
import {generateVisitedDisclosureSummary, type OnDemandAiRepository} from "@/server/on-demand-ai-use-cases";
import type {AiAnalysisCandidate} from "@/domain/ai-disclosure-summary";
const candidate: AiAnalysisCandidate = {eventId:"event",receiptNumber:"20261013000001",companyName:"상장기업",reportName:"주요사항보고서",disclosedOn:"2026-10-13",eventType:"M_AND_A",ruleImportanceScore:70,contentText:"합병기일 2026-12-01",inputHash:"a".repeat(64),sourceDocument:{id:"doc",title:"주요사항",kind:"MAIN",contentHash:"a".repeat(64)}};
const summary = {plainSummary:"합병일을 확인했습니다.",whyItMatters:"일정을 확인하세요.",checkpoints:[],cautions:[],importanceScore:60,factCandidates:[]};
const repo = {findPublishedByReceiptNumber:vi.fn(),findCandidateByReceiptNumber:vi.fn(),findCandidates:vi.fn(),begin:vi.fn(),complete:vi.fn(),fail:vi.fn()} satisfies OnDemandAiRepository;
const provider = {providerName:"google",modelName:"free-model",summarize:vi.fn()};
const guard = {acquire:vi.fn(),release:vi.fn()};
beforeEach(()=>{vi.clearAllMocks();repo.findPublishedByReceiptNumber.mockResolvedValue(null);repo.findCandidateByReceiptNumber.mockResolvedValue(candidate);repo.begin.mockResolvedValue(true);provider.summarize.mockResolvedValue(summary);guard.acquire.mockResolvedValue({status:"ACQUIRED",token:"lease"});});
describe("visited disclosure generation",()=>{
  it("reuses a published summary without any API call or lock",async()=>{
    repo.findPublishedByReceiptNumber.mockResolvedValue(summary);
    expect(await generateVisitedDisclosureSummary(candidate.receiptNumber,repo,provider,guard)).toEqual({status:"READY"});
    expect(provider.summarize).not.toHaveBeenCalled();expect(guard.acquire).not.toHaveBeenCalled();expect(repo.findCandidateByReceiptNumber).not.toHaveBeenCalled();
  });
  it("generates exactly the visited filing and persists verified fields",async()=>{
    expect(await generateVisitedDisclosureSummary(candidate.receiptNumber,repo,provider,guard)).toEqual({status:"READY"});
    expect(repo.findCandidateByReceiptNumber).toHaveBeenCalledWith(candidate.receiptNumber,"disclosure-summary-v4-all-types-safe-facts");
    expect(repo.findCandidates).not.toHaveBeenCalled();expect(provider.summarize).toHaveBeenCalledTimes(1);
    expect(repo.complete).toHaveBeenCalledWith("event",expect.any(String),provider,expect.objectContaining({verifiedFacts:[],plainSummary:summary.plainSummary}));
    expect(guard.release).toHaveBeenCalledWith("lease",undefined);
  });
  it.each([null,{...candidate,contentText:"개인 이름 홍길동, 개인별 보유수량 500주"}])("does not send unsafe or missing input",async row=>{
    repo.findCandidateByReceiptNumber.mockResolvedValue(row);
    expect(await generateVisitedDisclosureSummary(candidate.receiptNumber,repo,provider,guard)).toEqual({status:"SOURCE_UNAVAILABLE"});
    expect(provider.summarize).not.toHaveBeenCalled();expect(guard.acquire).not.toHaveBeenCalled();
  });
  it.each([{status:"BUSY",retryAfterSeconds:10},{status:"RATE_LIMIT"}])("does not call AI when guard reports $status",async result=>{
    guard.acquire.mockResolvedValue(result);
    expect((await generateVisitedDisclosureSummary(candidate.receiptNumber,repo,provider,guard)).status).toBe(result.status === "BUSY" ? "WAITING" : "RATE_LIMIT");
    expect(repo.begin).not.toHaveBeenCalled();expect(provider.summarize).not.toHaveBeenCalled();expect(guard.release).not.toHaveBeenCalled();
  });
  it("rechecks for a batch completion after acquiring the slot",async()=>{
    repo.findPublishedByReceiptNumber.mockResolvedValueOnce(null).mockResolvedValueOnce(summary);
    expect((await generateVisitedDisclosureSummary(candidate.receiptNumber,repo,provider,guard)).status).toBe("READY");
    expect(provider.summarize).not.toHaveBeenCalled();expect(guard.release).toHaveBeenCalledTimes(1);
  });
  it("waits for an existing event lock without duplicate generation",async()=>{
    repo.begin.mockResolvedValue(false);
    expect((await generateVisitedDisclosureSummary(candidate.receiptNumber,repo,provider,guard)).status).toBe("WAITING");
    expect(provider.summarize).not.toHaveBeenCalled();expect(guard.release).toHaveBeenCalledTimes(1);
  });
  it.each(["AI_RATE_LIMITED","AI_BILLING_REQUIRED","AI_AUTH_ERROR","AI_TIMEOUT","private details"])("releases failed generation safely: %s",async code=>{
    provider.summarize.mockRejectedValue(new Error(code));
    expect((await generateVisitedDisclosureSummary(candidate.receiptNumber,repo,provider,guard)).status).toBe(code === "AI_RATE_LIMITED" ? "RATE_LIMIT" : "DELAYED");
    expect(repo.fail).toHaveBeenCalledWith("event",expect.any(String),code === "private details" ? "AI_UPSTREAM_ERROR" : code);
    expect(repo.complete).not.toHaveBeenCalled();expect(guard.release).toHaveBeenCalledTimes(1);
  });
  it("releases after a database failure",async()=>{
    repo.begin.mockRejectedValueOnce(new Error("database"));
    await expect(generateVisitedDisclosureSummary(candidate.receiptNumber,repo,provider,guard)).rejects.toThrow("database");
    expect(guard.release).toHaveBeenCalledTimes(1);
  });
});

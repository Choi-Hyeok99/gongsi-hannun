import {describe,expect,it} from "vitest";
import {isRetryableAiAnalysis} from "@/domain/ai-analysis-retry";
const state={status:"FAILED",attemptCount:100,errorCode:"AI_RATE_LIMITED",updatedAt:"2026-10-13T06:59:00Z"};
describe("free AI quota retry",()=>{
  it("waits until the Pacific calendar day changes, including DST",()=>{
    expect(isRetryableAiAnalysis(state,Date.parse("2026-10-13T06:59:59Z"))).toBe(false);
    expect(isRetryableAiAnalysis(state,Date.parse("2026-10-13T07:00:00Z"))).toBe(true);
    expect(isRetryableAiAnalysis({...state,updatedAt:"2026-12-13T07:59:00Z"},Date.parse("2026-12-13T08:00:00Z"))).toBe(true);
  });
  it("never permanently exhausts retries because the free quota was hit",()=>{
    expect(isRetryableAiAnalysis(state,Date.parse("2026-10-14T10:00:00Z"))).toBe(true);
    expect(isRetryableAiAnalysis({...state,updatedAt:"invalid"})).toBe(false);
  });
  it.each(["AI_AUTH_ERROR","AI_INVALID_REQUEST","AI_REGION_UNAVAILABLE","AI_SCHEMA_ERROR","AI_MODEL_NOT_FOUND","AI_BILLING_REQUIRED"])("does not retry systemic %s",errorCode=>{
    expect(isRetryableAiAnalysis({...state,attemptCount:1,errorCode})).toBe(false);
  });
  it.each(["AI_TIMEOUT","AI_PROVIDER_UNAVAILABLE","AI_UPSTREAM_ERROR"])("bounds transient %s recovery instead of permanently stopping at two attempts",errorCode=>{
    expect(isRetryableAiAnalysis({...state,attemptCount:2,errorCode})).toBe(true);
    expect(isRetryableAiAnalysis({...state,attemptCount:4,errorCode})).toBe(false);
  });
});

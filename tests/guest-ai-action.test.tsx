import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_AGE_COOKIE_NAME, createAiAgeClaim, createGuestAiClaim, createGuestAiPendingClaim, GUEST_AI_COOKIE_NAME, GUEST_AI_PENDING_COOKIE_NAME } from "@/domain/guest-ai-access";

const mocks = vi.hoisted(() => ({getUser: vi.fn(), get: vi.fn(), set: vi.fn(), summary: vi.fn()}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({cookies: async () => ({get:mocks.get,set:mocks.set})}));
vi.mock("next/navigation", () => ({redirect: (path:string) => {throw new Error(`REDIRECT:${path}`);}}));
vi.mock("@/server/env", () => ({readServerEnvironment: () => ({SUPABASE_SECRET_KEY:"guest-test-secret"})}));
vi.mock("@/server/supabase/server", () => ({createSupabaseServerClient: async () => ({auth:{getUser:mocks.getUser}})}));
vi.mock("@/data/server-ai-analysis-repository", () => ({findAiDisclosureSummaryState:mocks.summary}));
import { openGuestAiSummary } from "@/app/disclosures/[receipt-number]/actions";
import { GuestAiSummaryGate } from "@/components/GuestAiSummaryGate";

const first = "20260923800549";
const second = "20260909800113";
const form = (receipt:string) => {const data=new FormData();data.set("receiptNumber",receipt);data.set("aiAdultConfirmed","on");return data;};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({data:{user:null}});
  mocks.get.mockReturnValue(undefined);
  mocks.summary.mockResolvedValue({status:"READY"});
});
describe("guest AI action", () => {
  it("claims only a ready summary with a secure signed cookie", async () => {
    await expect(openGuestAiSummary(form(first))).rejects.toThrow(`REDIRECT:/disclosures/${first}#ai-summary-heading`);
    expect(mocks.set).toHaveBeenCalledWith(GUEST_AI_COOKIE_NAME,expect.any(String),expect.objectContaining({httpOnly:true,sameSite:"lax",path:"/",maxAge:15552000}));
  });
  it.each(["FAILED","PENDING","NOT_GENERATED","UNAVAILABLE"])("does not consume a %s summary", async status => {
    mocks.summary.mockResolvedValue({status});
    await expect(openGuestAiSummary(form(first))).rejects.toThrow(`REDIRECT:/disclosures/${first}`);
    expect(mocks.set.mock.calls.some(call=>call[0]===GUEST_AI_COOKIE_NAME)).toBe(false);
    expect(mocks.set).toHaveBeenCalledWith(GUEST_AI_PENDING_COOKIE_NAME,expect.any(String),expect.objectContaining({maxAge:300,httpOnly:true}));
  });
  it("returns to the already pending guest filing instead of reserving another",async()=>{
    mocks.get.mockImplementation((name:string)=> name===AI_AGE_COOKIE_NAME ? {value:createAiAgeClaim("guest-test-secret")} : name===GUEST_AI_PENDING_COOKIE_NAME ? {value:createGuestAiPendingClaim(first,"guest-test-secret")} : undefined);
    await expect(openGuestAiSummary(form(second))).rejects.toThrow(`REDIRECT:/disclosures/${first}#ai-summary-heading`);
    expect(mocks.summary).not.toHaveBeenCalled();expect(mocks.set).not.toHaveBeenCalled();
  });
  it("allows revisits but blocks a second receipt without fetching its summary", async () => {
    mocks.get.mockImplementation((name:string) => ({value:name===AI_AGE_COOKIE_NAME ? createAiAgeClaim("guest-test-secret") : createGuestAiClaim(first,"guest-test-secret")}));
    await expect(openGuestAiSummary(form(first))).rejects.toThrow(`#ai-summary-heading`);
    await expect(openGuestAiSummary(form(second))).rejects.toThrow("REDIRECT:/login?next=");
    expect(mocks.summary).not.toHaveBeenCalled();
    expect(mocks.set.mock.calls.some(call=>call[0]===GUEST_AI_COOKIE_NAME)).toBe(false);
  });
  it("does not open a report or issue cookies without adult confirmation", async () => {
    const data=form(first);data.delete("aiAdultConfirmed");
    await expect(openGuestAiSummary(data)).rejects.toThrow(`REDIRECT:/disclosures/${first}`);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.summary).not.toHaveBeenCalled();
  });
  it("does not limit members and rejects malformed receipts", async () => {
    mocks.getUser.mockResolvedValue({data:{user:{id:"member"}}});
    await expect(openGuestAiSummary(form(second))).rejects.toThrow(`#ai-summary-heading`);
    await expect(openGuestAiSummary(form("../../account"))).rejects.toThrow("REDIRECT:/disclosures");
    expect(mocks.set.mock.calls.some(call=>call[0]===GUEST_AI_COOKIE_NAME)).toBe(false);
  });
  it("renders membership guidance without receiving protected summary content", () => {
    const fresh=renderToStaticMarkup(<GuestAiSummaryGate receiptNumber={first} alreadyUsed={false}/>);
    expect(fresh).toContain("AI 요약 1건 무료로 보기");
    const used=renderToStaticMarkup(<GuestAiSummaryGate receiptNumber={second} alreadyUsed/>);
    expect(used).not.toContain("<form");
    expect(used).toContain("무료 회원가입");
    expect(used).toContain("%2Fdisclosures%2F20260909800113");
  });
});

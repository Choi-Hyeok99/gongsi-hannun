import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks = vi.hoisted(()=>({access:vi.fn(),state:vi.fn(),generate:vi.fn(),set:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("next/headers",()=>({cookies:async()=>({set:mocks.set})}));
vi.mock("@/server/guest-ai-access",()=>({readGuestAiAccess:mocks.access}));
vi.mock("@/data/server-ai-analysis-repository",()=>({findAiDisclosureSummaryState:mocks.state}));
vi.mock("@/server/on-demand-ai-use-cases",()=>({generateVisitedDisclosureSummary:mocks.generate}));
vi.mock("@/server/env",()=>({readServerEnvironment:()=>({SUPABASE_URL:"https://example.supabase.co",SUPABASE_SECRET_KEY:"test-server-secret"})}));
import {POST} from "@/app/api/disclosures/[receipt-number]/ai-summary/route";
import {GUEST_AI_COOKIE_NAME,GUEST_AI_PENDING_COOKIE_NAME} from "@/domain/guest-ai-access";
const receipt="20261013000001";
const context=(value=receipt)=>({params:Promise.resolve({"receipt-number":value})});
const request=(origin="https://example.com")=>new Request(`https://example.com/api/disclosures/${receipt}/ai-summary`,{method:"POST",headers:{Origin:origin}});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("GEMINI_API_KEY","fake-key-never-used-over-network");mocks.access.mockResolvedValue("MEMBER");mocks.state.mockResolvedValue({status:"NOT_GENERATED"});mocks.generate.mockResolvedValue({status:"READY"});});
describe("on-demand API access",()=>{
  it.each(["MEMBER_AGE_REQUIRED","GUEST_AGE_REQUIRED","SIGN_IN","GUEST_AVAILABLE","GUEST_WAITING"])("blocks %s before database/generation",async access=>{
    mocks.access.mockResolvedValue(access);const response=await POST(request(),context());
    expect(response.status).toBe(403);expect(mocks.state).not.toHaveBeenCalled();expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects cross-site and invalid receipt requests before auth",async()=>{
    expect((await POST(request("https://evil.example"),context())).status).toBe(403);
    expect((await POST(request(),context("../../../"))).status).toBe(404);expect(mocks.access).not.toHaveBeenCalled();
  });
  it("reuses stored summaries without a runtime key and never returns the protected text",async()=>{
    vi.stubEnv("GEMINI_API_KEY","");mocks.state.mockResolvedValue({status:"READY",summary:{plainSummary:"protected text"}});
    const response=await POST(request(),context());expect(await response.json()).toEqual({status:"READY"});expect(mocks.generate).not.toHaveBeenCalled();expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("fails closed with a missing key",async()=>{
    vi.stubEnv("GEMINI_API_KEY","");const response=await POST(request(),context());expect(response.status).toBe(503);expect(await response.json()).toEqual({status:"UNAVAILABLE"});expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("claims a successful guest preview and clears its pending cookie",async()=>{
    mocks.access.mockResolvedValue("GUEST_REQUESTED");const response=await POST(request(),context());expect(await response.json()).toEqual({status:"READY"});
    expect(mocks.set).toHaveBeenCalledWith(GUEST_AI_COOKIE_NAME,expect.any(String),expect.objectContaining({httpOnly:true,maxAge:15552000}));
    expect(mocks.set).toHaveBeenCalledWith(GUEST_AI_PENDING_COOKIE_NAME,"",expect.objectContaining({maxAge:0}));
  });
  it.each(["RATE_LIMIT","DELAYED","SOURCE_UNAVAILABLE"])("does not consume a guest preview on %s",async status=>{
    mocks.access.mockResolvedValue("GUEST_REQUESTED");mocks.generate.mockResolvedValue({status});await POST(request(),context());
    expect(mocks.set.mock.calls.some(call=>call[0]===GUEST_AI_COOKIE_NAME)).toBe(false);
    expect(mocks.set).toHaveBeenCalledWith(GUEST_AI_PENDING_COOKIE_NAME,"",expect.objectContaining({maxAge:0}));
  });
  it("keeps pending reservations during processing",async()=>{
    mocks.access.mockResolvedValue("GUEST_REQUESTED");mocks.generate.mockResolvedValue({status:"WAITING",retryAfterSeconds:10});
    expect((await POST(request(),context())).status).toBe(202);expect(mocks.set).not.toHaveBeenCalled();
  });
  it("never exposes raw server errors",async()=>{
    mocks.generate.mockRejectedValue(new Error("secret-value upstream"));const response=await POST(request(),context());expect(await response.text()).not.toContain("secret-value");expect(response.status).toBe(503);
  });
});

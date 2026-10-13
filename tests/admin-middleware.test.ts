import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),consent:vi.fn()}));
vi.mock("@supabase/ssr",()=>({createServerClient:()=>({auth:{getUser:mocks.getUser}})}));
vi.mock("@/server/supabase/config",()=>({readPublicSupabaseEnvironment:()=>({url:"https://example.supabase.co",publishableKey:"test-publishable-key"})}));
vi.mock("@/server/consent",()=>({hasRequiredPolicyConsents:mocks.consent}));
import {middleware,config} from "@/middleware";
const owner="12345678-1234-1234-1234-123456789abc";
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("ADMIN_USER_IDS",owner);mocks.getUser.mockResolvedValue({data:{user:null},error:null});mocks.consent.mockResolvedValue(true);});
describe("admin-only edge gate",()=>{
  it("does not expand middleware to market or existing login pages",()=>expect(config.matcher).toEqual(["/admin/:path*","/api/admin/:path*"]));
  it("redirects an unauthenticated dashboard request before page streaming",async()=>{const response=await middleware(new NextRequest("https://example.com/admin"));expect(response.status).toBe(307);expect(response.headers.get("location")).toContain("/login?next=%2Fadmin");expect(response.headers.get("cache-control")).toContain("no-store");});
  it("blocks a forged admin cookie without a verified user",async()=>{const response=await middleware(new NextRequest("https://example.com/api/admin/overview",{headers:{Cookie:"admin=true; role=admin"}}));expect(response.status).toBe(401);expect(mocks.consent).not.toHaveBeenCalled();});
  it("denies an ordinary member with user-editable admin metadata",async()=>{mocks.getUser.mockResolvedValue({data:{user:{id:"12345678-1234-1234-1234-123456789abd",user_metadata:{role:"admin"}}},error:null});expect((await middleware(new NextRequest("https://example.com/admin"))).status).toBe(404);expect((await middleware(new NextRequest("https://example.com/api/admin/overview"))).status).toBe(403);});
  it("fails closed even if an invalid auth response includes the owner ID",async()=>{mocks.getUser.mockResolvedValue({data:{user:{id:owner}},error:{message:"invalid JWT"}});expect((await middleware(new NextRequest("https://example.com/api/admin/overview"))).status).toBe(401);});
  it("allows only the configured owner, retaining consent requirements",async()=>{mocks.getUser.mockResolvedValue({data:{user:{id:owner}},error:null});expect((await middleware(new NextRequest("https://example.com/admin"))).status).toBe(200);mocks.consent.mockResolvedValue(false);expect((await middleware(new NextRequest("https://example.com/admin"))).headers.get("location")).toContain("/consent");});
});

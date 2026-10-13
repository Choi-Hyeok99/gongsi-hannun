import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),dashboard:vi.fn()}));
vi.mock("@/server/admin-access",()=>({readAdminAccess:mocks.access}));
vi.mock("@/server/admin-dashboard",()=>({readAdminDashboard:mocks.dashboard}));
import {GET} from "@/app/api/admin/overview/route";
beforeEach(()=>{vi.clearAllMocks();mocks.dashboard.mockResolvedValue({counts:{members:3}});});
describe("private admin API",()=>{
  it.each([["SIGN_IN",401],["FORBIDDEN",403]])("blocks %s before reading service-role data",async(access,status)=>{
    mocks.access.mockResolvedValue(access);const response=await GET();expect(response.status).toBe(status);expect(mocks.dashboard).not.toHaveBeenCalled();expect(await response.text()).not.toContain("members");expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("returns data only for an authenticated provisioned admin",async()=>{
    mocks.access.mockResolvedValue("ADMIN");const response=await GET();expect(await response.json()).toEqual({counts:{members:3}});expect(response.headers.get("vary")).toBe("Cookie");expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
  it("never exposes service credentials or raw provider errors",async()=>{
    mocks.access.mockResolvedValue("ADMIN");mocks.dashboard.mockRejectedValue(new Error("secret API token"));const response=await GET();expect(response.status).toBe(503);expect(await response.text()).not.toContain("secret");
  });
});

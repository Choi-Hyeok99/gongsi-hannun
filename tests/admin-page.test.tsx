import React from "react";
import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),dashboard:vi.fn()}));
vi.mock("@/server/admin-access",()=>({readAdminAccess:mocks.access}));
vi.mock("@/server/admin-dashboard",()=>({readAdminDashboard:mocks.dashboard}));
vi.mock("@/components/SiteHeader",()=>({SiteHeader:()=>null}));
vi.mock("@/components/SiteFooter",()=>({SiteFooter:()=>null}));
vi.mock("@/components/AdminDashboardView",()=>({AdminDashboardView:()=>React.createElement("div",null,"private dashboard")}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`REDIRECT:${path}`);},notFound:()=>{throw new Error("NOT_FOUND");}}));
import AdminPage,{metadata,dynamic} from "@/app/admin/page";
beforeEach(()=>{vi.clearAllMocks();mocks.dashboard.mockResolvedValue({});});
describe("private admin page",()=>{
  it("sends logged-out visitors through existing email/Kakao login",async()=>{mocks.access.mockResolvedValue("SIGN_IN");await expect(AdminPage()).rejects.toThrow("REDIRECT:/login?next=%2Fadmin");expect(mocks.dashboard).not.toHaveBeenCalled();});
  it("does not render metrics to an ordinary member",async()=>{mocks.access.mockResolvedValue("FORBIDDEN");await expect(AdminPage()).rejects.toThrow("NOT_FOUND");expect(mocks.dashboard).not.toHaveBeenCalled();});
  it("renders only after authorization and is not indexable/static",async()=>{mocks.access.mockResolvedValue("ADMIN");expect(await AdminPage()).toBeTruthy();expect(mocks.dashboard).toHaveBeenCalledTimes(1);expect(metadata.robots).toEqual({index:false,follow:false});expect(dynamic).toBe("force-dynamic");});
});

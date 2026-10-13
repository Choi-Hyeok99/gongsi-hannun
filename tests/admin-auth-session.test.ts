import {beforeEach,describe,expect,it,vi} from "vitest";
const getUser=vi.hoisted(()=>vi.fn());
vi.mock("server-only",()=>({}));
vi.mock("@/server/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser}})}));
import {readAdminAccess} from "@/server/admin-access";
const owner="12345678-1234-1234-1234-123456789abc";
beforeEach(()=>{vi.stubEnv("ADMIN_USER_IDS",owner);vi.clearAllMocks();});
describe("verified operator session",()=>{
  it("requires server-verified authentication",async()=>{getUser.mockResolvedValue({data:{user:{id:owner}},error:{message:"invalid session"}});expect(await readAdminAccess()).toBe("SIGN_IN");});
  it("does not grant permissions from editable user metadata or matching email",async()=>{getUser.mockResolvedValue({data:{user:{id:"12345678-1234-1234-1234-123456789abd",email:"gur0709@naver.com",user_metadata:{role:"admin"}}},error:null});expect(await readAdminAccess()).toBe("FORBIDDEN");});
  it("allows the exact provisioned auth ID",async()=>{getUser.mockResolvedValue({data:{user:{id:owner}},error:null});expect(await readAdminAccess()).toBe("ADMIN");});
  it("fails closed if the auth service throws",async()=>{getUser.mockRejectedValue(new Error("private details"));expect(await readAdminAccess()).toBe("SIGN_IN");});
});

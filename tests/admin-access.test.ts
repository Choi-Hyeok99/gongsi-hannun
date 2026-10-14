import {describe,expect,it} from "vitest";
import {isAdminUser} from "@/domain/admin-access";
const owner="12345678-1234-1234-1234-123456789abc";
describe("operator authorization",()=>{
  it("fails closed without configuration",()=>{expect(isAdminUser(owner,undefined)).toBe(false);expect(isAdminUser(null,owner)).toBe(false);});
  it("accepts only an exact valid provisioned user ID",()=>{expect(isAdminUser(owner,` ${owner.toUpperCase()} `)).toBe(true);expect(isAdminUser("12345678-1234-1234-1234-123456789abd",owner)).toBe(false);});
  it.each(["admin","admin1234","gur0709@naver.com","*","12345678"] )("does not authorize %s",value=>{expect(isAdminUser(value,value)).toBe(false);expect(isAdminUser(owner,value)).toBe(false);});
});

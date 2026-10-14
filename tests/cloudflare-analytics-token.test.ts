import {describe,expect,it} from "vitest";
import {normalizeAnalyticsToken} from "@/domain/cloudflare-analytics-token";
const token="a".repeat(40);
describe("safe copied analytics credential normalization",()=>{
  it("uses the exact raw token and strips only outer whitespace",()=>expect(normalizeAnalyticsToken(` ${token}\n`)).toEqual({token,format:"RAW"}));
  it("handles enclosing quotes without changing the actual credential",()=>expect(normalizeAnalyticsToken(`"${token}"`)).toEqual({token,format:"QUOTED"}));
  it("extracts an explicitly copied Bearer header without executing the command",()=>expect(normalizeAnalyticsToken(`curl https://api.cloudflare.com/client/v4/user/tokens/verify --header "Authorization: Bearer ${token}"`)).toEqual({token,format:"BEARER_SNIPPET"}));
  it("never guesses an unrelated key from a command or JSON object",()=>expect(normalizeAnalyticsToken(`{"anotherKey":"${token}"}`).format).toBe("UNRECOGNIZED"));
});

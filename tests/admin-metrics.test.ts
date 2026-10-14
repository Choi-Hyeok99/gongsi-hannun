import {describe,expect,it} from "vitest";
import {currentGuardCalls,nonNegativeCount,paidEquivalentUsd,seoulDayStart} from "@/domain/admin-metrics";
describe("honest operation metrics",()=>{
  it("uses Seoul midnight including UTC date rollover",()=>{expect(seoulDayStart(new Date("2026-10-13T15:01:00Z"))).toBe("2026-10-13T15:00:00.000Z");expect(seoulDayStart(new Date("2026-10-13T15:01:00Z"),6)).toBe("2026-10-07T15:00:00.000Z");});
  it("does not report yesterday's guard calls as today's",()=>{const now=new Date("2026-10-14T09:00:00Z");expect(currentGuardCalls("2026-10-13",98,now)).toBe(0);expect(currentGuardCalls("2026-10-14",12,now)).toBe(12);expect(currentGuardCalls(null,null,now)).toBeNull();});
  it.each([null,undefined,"0",-1,NaN,Infinity,1.5])("does not turn missing or invalid %s into zero",value=>expect(nonNegativeCount(value)).toBeNull());
  it("keeps actual zero and uses model-specific paid comparisons",()=>{expect(nonNegativeCount(0)).toBe(0);expect(paidEquivalentUsd("gemini-3.1-flash-lite",1_000_000,1_000_000)).toBe(1.75);expect(paidEquivalentUsd("gemini-3.5-flash-lite",1_000_000,1_000_000)).toBe(2.8);expect(paidEquivalentUsd("unknown",100,100)).toBeNull();});
});

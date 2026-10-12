import { describe, expect, it } from "vitest";
import { createAiAgeClaim, createGuestAiClaim, guestAiAccess, GUEST_AI_COOKIE_MAX_AGE, readAiAgeClaim, readGuestAiClaim } from "@/domain/guest-ai-access";

const secret = "test-signing-key-that-is-never-used-in-production";
const receipt = "20261012000001";
const now = Date.parse("2026-10-12T00:00:00Z");

describe("guest AI preview access", () => {
  it("allows one report, repeat visits to it, and all reports for members", () => {
    expect(guestAiAccess(false,receipt,null,true)).toBe("GUEST_AVAILABLE");
    expect(guestAiAccess(false,receipt,receipt,true)).toBe("GUEST_ALLOWED");
    expect(guestAiAccess(false,"20261012000002",receipt,true)).toBe("SIGN_IN");
    expect(guestAiAccess(true,"20261012000002",receipt,true)).toBe("MEMBER");
  });
  it("requires a signed adult declaration even for members", () => {
    expect(guestAiAccess(true,receipt,null)).toBe("MEMBER_AGE_REQUIRED");
    expect(guestAiAccess(false,receipt,null)).toBe("GUEST_AGE_REQUIRED");
    const token=createAiAgeClaim(secret,now);
    expect(readAiAgeClaim(token,secret,now)).toBe(true);
    expect(readAiAgeClaim(token,"wrong-secret",now)).toBe(false);
    expect(readAiAgeClaim(token,secret,now+GUEST_AI_COOKIE_MAX_AGE*1000)).toBe(false);
    expect(readAiAgeClaim(createGuestAiClaim(receipt,secret,now),secret,now)).toBe(false);
  });
  it("rejects edited, expired and cross-key claims", () => {
    const token = createGuestAiClaim(receipt,secret,now);
    expect(readGuestAiClaim(token,secret,now)).toBe(receipt);
    expect(readGuestAiClaim(token.replace(receipt,"20261012000002"),secret,now)).toBeNull();
    expect(readGuestAiClaim(token,secret,now+GUEST_AI_COOKIE_MAX_AGE*1000)).toBeNull();
    expect(readGuestAiClaim(token,"another-secret",now)).toBeNull();
    expect(readGuestAiClaim("invalid",secret,now)).toBeNull();
    expect(readGuestAiClaim("x".repeat(500),secret,now)).toBeNull();
  });
  it("cannot issue a claim for an invalid receipt number",()=>{
    expect(()=>createGuestAiClaim("/../../",secret,now)).toThrow();
  });
});

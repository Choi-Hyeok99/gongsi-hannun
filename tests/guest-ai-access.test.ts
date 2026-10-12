import { describe, expect, it } from "vitest";
import { createAiAgeClaim, createGuestAiClaim, createGuestAiPendingClaim, guestAiAccess, GUEST_AI_COOKIE_MAX_AGE, GUEST_AI_PENDING_MAX_AGE, readAiAgeClaim, readGuestAiClaim, readGuestAiPendingClaim } from "@/domain/guest-ai-access";

const secret = "test-signing-key-that-is-never-used-in-production";
const receipt = "20261012000001";
const now = Date.parse("2026-10-12T00:00:00Z");

describe("guest AI preview access", () => {
  it("temporarily reserves an ungenerated report without consuming the preview",()=>{
    expect(guestAiAccess(false,receipt,null,true,receipt)).toBe("GUEST_REQUESTED");
    expect(guestAiAccess(false,"20261012000002",null,true,receipt)).toBe("GUEST_WAITING");
    expect(guestAiAccess(false,"20261012000002",receipt,true,"20261012000002")).toBe("SIGN_IN");
    const pending=createGuestAiPendingClaim(receipt,secret,now);
    expect(readGuestAiPendingClaim(pending,secret,now)).toBe(receipt);
    expect(readGuestAiPendingClaim(pending,secret,now+GUEST_AI_PENDING_MAX_AGE*1000)).toBeNull();
    expect(readGuestAiClaim(pending,secret,now)).toBeNull();
    expect(readGuestAiPendingClaim(createGuestAiClaim(receipt,secret,now),secret,now)).toBeNull();
  });
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

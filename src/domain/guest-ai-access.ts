import { createHmac, timingSafeEqual } from "node:crypto";

export const GUEST_AI_COOKIE_NAME = "gongsi-ai-preview";
export const AI_AGE_COOKIE_NAME = "gongsi-ai-adult";
export const GUEST_AI_COOKIE_MAX_AGE = 180 * 24 * 60 * 60;
export const isReceiptNumber = (value: string) => /^\d{14}$/.test(value);

export function createGuestAiClaim(receiptNumber: string, secret: string, now = Date.now()): string {
  if (!isReceiptNumber(receiptNumber) || !secret) throw new Error("Invalid guest AI claim");
  const expiresAt = Math.floor(now / 1_000) + GUEST_AI_COOKIE_MAX_AGE;
  const payload = `1.${receiptNumber}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function readGuestAiClaim(value: string | undefined, secret: string, now = Date.now()): string | null {
  if (!value || !secret || value.length > 120) return null;
  const match = /^(1\.(\d{14})\.(\d{10}))\.([a-f0-9]{64})$/.exec(value);
  const [, payload, receipt, expiry, signature] = match ?? [];
  if (!payload || !receipt || !expiry || !signature || Number(expiry) <= Math.floor(now / 1_000)) return null;
  const expected = Buffer.from(sign(payload, secret), "hex");
  const actual = Buffer.from(signature, "hex");
  return timingSafeEqual(expected, actual) ? receipt : null;
}

export function createAiAgeClaim(secret: string, now = Date.now()): string {
  const payload = `adult.${Math.floor(now / 1_000) + GUEST_AI_COOKIE_MAX_AGE}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function readAiAgeClaim(value: string | undefined, secret: string, now = Date.now()): boolean {
  const match = value && /^((?:adult)\.(\d{10}))\.([a-f0-9]{64})$/.exec(value);
  if (!match?.[1] || !match[2] || !match[3] || !secret || Number(match[2]) <= Math.floor(now / 1_000)) return false;
  return timingSafeEqual(Buffer.from(sign(match[1], secret), "hex"), Buffer.from(match[3], "hex"));
}

export function guestAiAccess(isMember: boolean, receiptNumber: string, claimedReceipt: string | null, adultConfirmed = false) {
  if (!adultConfirmed) return isMember ? "MEMBER_AGE_REQUIRED" as const : "GUEST_AGE_REQUIRED" as const;
  if (isMember) return "MEMBER" as const;
  if (claimedReceipt === receiptNumber) return "GUEST_ALLOWED" as const;
  return claimedReceipt ? "SIGN_IN" as const : "GUEST_AVAILABLE" as const;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`gongsi-guest-ai-preview-v1:${payload}`).digest("hex");
}

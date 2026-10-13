import { createHmac, timingSafeEqual } from "node:crypto";

export const GUEST_AI_COOKIE_NAME = "gongsi-ai-preview";
export const AI_AGE_COOKIE_NAME = "gongsi-ai-adult";
export const GUEST_AI_PENDING_COOKIE_NAME = "gongsi-ai-pending";
export const GUEST_AI_PENDING_MAX_AGE = 5 * 60;
export const GUEST_AI_COOKIE_MAX_AGE = 180 * 24 * 60 * 60;
export const isReceiptNumber = (value: string) => /^\d{14}$/.test(value);

export function createGuestAiClaim(receiptNumber: string, secret: string, now = Date.now()): string {
  return createReceiptClaim(receiptNumber, secret, "1", GUEST_AI_COOKIE_MAX_AGE, now);
}

export function createGuestAiPendingClaim(receiptNumber: string, secret: string, now = Date.now()): string {
  return createReceiptClaim(receiptNumber, secret, "pending", GUEST_AI_PENDING_MAX_AGE, now);
}

function createReceiptClaim(receiptNumber: string, secret: string, purpose: "1" | "pending", maxAge: number, now: number): string {
  if (!isReceiptNumber(receiptNumber) || !secret) throw new Error("Invalid guest AI claim");
  const expiresAt = Math.floor(now / 1_000) + maxAge;
  const payload = `${purpose}.${receiptNumber}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function readGuestAiClaim(value: string | undefined, secret: string, now = Date.now()): string | null {
  return readReceiptClaim(value, secret, "1", now);
}

export function readGuestAiPendingClaim(value: string | undefined, secret: string, now = Date.now()): string | null {
  return readReceiptClaim(value, secret, "pending", now);
}

function readReceiptClaim(value: string | undefined, secret: string, purpose: "1" | "pending", now: number): string | null {
  if (!value || !secret || value.length > 120) return null;
  const pattern = purpose === "1" ? /^(1\.(\d{14})\.(\d{10}))\.([a-f0-9]{64})$/ : /^(pending\.(\d{14})\.(\d{10}))\.([a-f0-9]{64})$/;
  const match = pattern.exec(value);
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

export function guestAiAccess(isMember: boolean, receiptNumber: string, claimedReceipt: string | null, adultConfirmed = false, pendingReceipt: string | null = null) {
  if (!adultConfirmed) return isMember ? "MEMBER_AGE_REQUIRED" as const : "GUEST_AGE_REQUIRED" as const;
  if (isMember) return "MEMBER" as const;
  if (claimedReceipt === receiptNumber) return "GUEST_ALLOWED" as const;
  if (claimedReceipt) return "SIGN_IN" as const;
  if (pendingReceipt) return pendingReceipt === receiptNumber ? "GUEST_REQUESTED" as const : "GUEST_WAITING" as const;
  return "GUEST_AVAILABLE" as const;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`gongsi-guest-ai-preview-v1:${payload}`).digest("hex");
}

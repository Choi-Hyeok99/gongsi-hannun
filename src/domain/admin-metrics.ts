export const AI_USAGE_SOURCE = "ADMIN_AI_USAGE_V1";
export type AiUsageMeasurement = Readonly<{
  model: string;
  succeeded: boolean;
  errorCode: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  startedAt: string;
  finishedAt: string;
}>;

export function nonNegativeCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
export function seoulDayStart(now = new Date(), daysAgo = 0): string {
  const shifted = new Date(now.getTime() + 9 * 3_600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - daysAgo) - 9 * 3_600_000).toISOString();
}
export function pacificQuotaDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
}
export function currentGuardCalls(quotaDay: unknown, calls: unknown, now = new Date()): number | null {
  if (typeof quotaDay !== "string") return null;
  return quotaDay === pacificQuotaDay(now) ? nonNegativeCount(calls) : 0;
}
// A paid-price comparison, never a claim about an invoice or the project's tier.
export function paidEquivalentUsd(model: string, input: number, output: number): number | null {
  const prices: Record<string, readonly [number, number]> = {
    "gemini-3.1-flash-lite": [0.25, 1.5],
    "gemini-3.5-flash-lite": [0.3, 2.5],
  };
  const rate = prices[model];
  if (!rate || nonNegativeCount(input) === null || nonNegativeCount(output) === null) return null;
  return (input * rate[0] + output * rate[1]) / 1_000_000;
}

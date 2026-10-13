export type AiAnalysisRetryState = Readonly<{status:string;attemptCount:number;errorCode:string;updatedAt?:string;leaseExpiresAt?:string}>;

export function isRetryableAiAnalysis(state: AiAnalysisRetryState, now = Date.now()): boolean {
  if (state.status === "PENDING") return true;
  if (state.status === "PROCESSING") {
    const expiry = Date.parse(state.leaseExpiresAt ?? "");
    return Number.isFinite(expiry) && expiry <= now && state.attemptCount < 20;
  }
  if (state.status !== "FAILED") return false;
  if (["AI_INVALID_REQUEST", "AI_REGION_UNAVAILABLE", "AI_SCHEMA_ERROR", "AI_AUTH_ERROR", "AI_MODEL_NOT_FOUND", "AI_BILLING_REQUIRED"].includes(state.errorCode)) return false;
  if (state.errorCode === "AI_RATE_LIMITED") {
    const previous=Date.parse(state.updatedAt ?? "");
    if (Number.isNaN(previous)) return false;
    return pacificDay(previous) < pacificDay(now);
  }
  if (["AI_UPSTREAM_ERROR", "AI_TIMEOUT", "AI_PROVIDER_UNAVAILABLE"].includes(state.errorCode)) return state.attemptCount < 4;
  return state.attemptCount < 2;
}

function pacificDay(value: number): string {
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
  const get=(type:string)=>parts.find(part=>part.type===type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

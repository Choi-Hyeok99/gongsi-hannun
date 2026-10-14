export function normalizeAnalyticsToken(value:string):{token:string;format:"RAW"|"QUOTED"|"BEARER_SNIPPET"|"UNRECOGNIZED"} {
  const trimmed=value.trim();
  const quoted=trimmed.match(/^["']([A-Za-z0-9_-]{30,200})["']$/);
  if(quoted)return {token:quoted[1]!,format:"QUOTED"};
  const bearer=trimmed.match(/\bBearer\s+["']?([A-Za-z0-9_-]{30,200})/i);
  if(bearer)return {token:bearer[1]!,format:"BEARER_SNIPPET"};
  return {token:trimmed,format:/^[A-Za-z0-9_-]{20,200}$/.test(trimmed) ? "RAW" : "UNRECOGNIZED"};
}

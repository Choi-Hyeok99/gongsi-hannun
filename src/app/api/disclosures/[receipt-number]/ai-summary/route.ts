import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { findAiDisclosureSummaryState } from "@/data/server-ai-analysis-repository";
import { SupabaseAiAnalysisRepository } from "@/data/supabase-ai-analysis-repository";
import { SupabaseOnDemandAiGuard } from "@/data/supabase-on-demand-ai-guard";
import { createGuestAiClaim, GUEST_AI_COOKIE_MAX_AGE, GUEST_AI_COOKIE_NAME, GUEST_AI_PENDING_COOKIE_NAME, isReceiptNumber } from "@/domain/guest-ai-access";
import { GeminiDisclosureSummaryClient } from "@/jobs/analyzer/gemini-summary-client";
import { readGuestAiAccess } from "@/server/guest-ai-access";
import { readServerEnvironment } from "@/server/env";
import { generateVisitedDisclosureSummary, type OnDemandAiResult } from "@/server/on-demand-ai-use-cases";

export const dynamic = "force-dynamic";
type Context = {params:Promise<{"receipt-number":string}>};
const headers = {"Cache-Control":"private, no-store",Vary:"Cookie, Origin"};
function respond(result: OnDemandAiResult | {status:"AGE_REQUIRED"|"SIGN_IN"}, status = 200) {
  return NextResponse.json(result,{status,headers});
}

export async function POST(request: Request, context: Context) {
  // The browser initiates generation only after the page opens, never from GET/prefetch.
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({status:"FORBIDDEN"},{status:403,headers});
  }
  const {"receipt-number":receipt} = await context.params;
  if (!isReceiptNumber(receipt)) return NextResponse.json({status:"NOT_FOUND"},{status:404,headers});
  try {
    const access = await readGuestAiAccess(receipt);
    if (access === "MEMBER_AGE_REQUIRED" || access === "GUEST_AGE_REQUIRED") return respond({status:"AGE_REQUIRED"},403);
    if (access === "SIGN_IN" || access === "GUEST_AVAILABLE" || access === "GUEST_WAITING") return respond({status:"SIGN_IN"},403);
    const state = await findAiDisclosureSummaryState(receipt);
    let result: OnDemandAiResult;
    if (state.status === "READY") result = {status:"READY"};
    else {
      const key = process.env.GEMINI_API_KEY;
      // Do not serialize env validation errors, upstream response bodies or credentials.
      if (!key || key.length < 20) result = {status:"UNAVAILABLE"};
      else {
        const environment = readServerEnvironment();
        const client = createClient(environment.SUPABASE_URL,environment.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
        result = await generateVisitedDisclosureSummary(receipt,
          new SupabaseAiAnalysisRepository(client,true),
          new GeminiDisclosureSummaryClient({apiKey:key,timeoutMs:60_000,onFailure:failure=>console.warn("AI_PROVIDER_FAILURE",JSON.stringify(failure))}),
          new SupabaseOnDemandAiGuard(client));
      }
      if (result.status === "SOURCE_UNAVAILABLE" && state.status === "PROCESSING") result = {status:"WAITING",retryAfterSeconds:10};
      else if (result.status === "SOURCE_UNAVAILABLE" && state.status === "PENDING" && state.reason === "RATE_LIMIT") result = {status:"RATE_LIMIT"};
      else if (result.status === "SOURCE_UNAVAILABLE" && state.status === "FAILED") result = {status:"DELAYED"};
    }
    if (access === "GUEST_REQUESTED") {
      const store = await cookies();
      const options = {httpOnly:true,secure:process.env.NODE_ENV === "production",sameSite:"lax" as const,path:"/"};
      if (result.status === "READY") {
        store.set(GUEST_AI_COOKIE_NAME,createGuestAiClaim(receipt,readServerEnvironment().SUPABASE_SECRET_KEY),{...options,maxAge:GUEST_AI_COOKIE_MAX_AGE});
      }
      if (result.status !== "WAITING" && result.status !== "RETRYING") store.set(GUEST_AI_PENDING_COOKIE_NAME,"",{...options,maxAge:0});
    }
    return respond(result,result.status === "WAITING" || result.status === "RETRYING" ? 202 : result.status === "UNAVAILABLE" ? 503 : 200);
  } catch {
    return respond({status:"UNAVAILABLE"},503);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnDemandAiGuard } from "@/server/on-demand-ai-use-cases";
import { DataAccessError } from "@/domain/errors";

export class SupabaseOnDemandAiGuard implements OnDemandAiGuard {
  constructor(private readonly client: SupabaseClient) {}
  async acquire(): ReturnType<OnDemandAiGuard["acquire"]> {
    const {data,error} = await this.client.rpc("acquire_on_demand_ai_slot");
    if (error) throw new DataAccessError("AI 호출 잠금을 확인하지 못했습니다.");
    if (data?.status === "ACQUIRED" && typeof data.token === "string") return {status:"ACQUIRED",token:data.token};
    if (data?.status === "RATE_LIMIT") return {status:"RATE_LIMIT"};
    if (data?.status === "UNAVAILABLE") return {status:"UNAVAILABLE"};
    if (data?.status === "BUSY") return {status:"BUSY",retryAfterSeconds:10};
    throw new DataAccessError("AI 호출 잠금 응답이 올바르지 않습니다.");
  }
  async release(token: string, errorCode?: string): Promise<void> {
    const {error} = await this.client.rpc("release_on_demand_ai_slot",{p_token:token,p_error_code:errorCode ?? null});
    if (error) throw new DataAccessError("AI 호출 잠금을 해제하지 못했습니다.");
  }
}

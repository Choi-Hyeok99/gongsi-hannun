import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WatchlistRepository } from "@/domain/watchlist";
import { DataAccessError } from "@/domain/errors";

type WatchlistRow = Readonly<{ company_id: string }>;

export class SupabaseWatchlistRepository implements WatchlistRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listCompanyIds(userId: string): Promise<readonly string[]> {
    const { data, error } = await this.client
      .from("watchlist_companies")
      .select("company_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new DataAccessError("관심기업 목록을 불러오지 못했습니다.");
    return (data as WatchlistRow[]).map(({ company_id: companyId }) => companyId);
  }

  async isSaved(userId: string, companyId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("watchlist_companies")
      .select("company_id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new DataAccessError("관심기업 상태를 확인하지 못했습니다.");
    return data !== null;
  }

  async save(userId: string, companyId: string): Promise<void> {
    const { error } = await this.client.from("watchlist_companies").insert({ user_id: userId, company_id: companyId });
    if (error && error.code !== "23505") throw new DataAccessError("관심기업을 저장하지 못했습니다.");
  }

  async remove(userId: string, companyId: string): Promise<void> {
    const { error } = await this.client
      .from("watchlist_companies")
      .delete()
      .eq("user_id", userId)
      .eq("company_id", companyId);
    if (error) throw new DataAccessError("관심기업을 해제하지 못했습니다.");
  }
}

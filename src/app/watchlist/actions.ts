"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createWatchlistCompanyReader } from "@/data/supabase-watchlist-company-reader";
import { SupabaseWatchlistRepository } from "@/data/supabase-watchlist-repository";
import { parseWatchlistCommand } from "@/domain/watchlist";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { setSavedState } from "@/server/watchlist-use-cases";

function companyPath(stockCode: string): string {
  return `/companies/${stockCode}`;
}

function redirectWithStatus(path: string, kind: "error" | "message", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

export async function updateWatchlist(formData: FormData) {
  const command = parseWatchlistCommand(formData);
  if (!command.success) redirectWithStatus("/search?query=삼성", "error", "올바르지 않은 요청입니다.");

  const path = companyPath(command.stockCode);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}&message=${encodeURIComponent("로그인 후 관심기업을 저장할 수 있습니다.")}`);

  const company = await createWatchlistCompanyReader().findByStockCode(command.stockCode);
  if (!company) redirectWithStatus(path, "error", "기업 정보를 찾지 못했습니다.");

  try {
    await setSavedState(new SupabaseWatchlistRepository(supabase), user.id, company.id, command.intent);
  } catch {
    redirectWithStatus(path, "error", "관심기업 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  revalidatePath(path);
  revalidatePath("/watchlist");
  redirectWithStatus(path, "message", command.intent === "save" ? "관심기업에 저장했습니다." : "관심기업에서 해제했습니다.");
}

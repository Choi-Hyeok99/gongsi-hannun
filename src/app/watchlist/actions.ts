"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createWatchlistCompanyReader } from "@/data/supabase-watchlist-company-reader";
import { SupabaseWatchlistRepository } from "@/data/supabase-watchlist-repository";
import { SupabaseAlertPreferenceRepository } from "@/data/supabase-notification-center-repository";
import { parseAlertPreference } from "@/domain/notification-center";
import { parseWatchlistCommand } from "@/domain/watchlist";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { setSavedState } from "@/server/watchlist-use-cases";
import { ensureDefaultAlertPreference, updateAlertPreference } from "@/server/notification-center-use-cases";
import { requirePolicyConsents } from "@/server/consent";

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
  await requirePolicyConsents(supabase, user.id, path);

  const company = await createWatchlistCompanyReader().findByStockCode(command.stockCode);
  if (!company) redirectWithStatus(path, "error", "기업 정보를 찾지 못했습니다.");

  try {
    await setSavedState(new SupabaseWatchlistRepository(supabase), user.id, company.id, command.intent);
    if (command.intent === "save") {
      await ensureDefaultAlertPreference(new SupabaseAlertPreferenceRepository(supabase), user.id, company.id);
    }
  } catch {
    redirectWithStatus(path, "error", "관심기업 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  revalidatePath(path);
  revalidatePath("/watchlist");
  redirectWithStatus(path, "message", command.intent === "save" ? "관심기업에 저장했습니다." : "관심기업에서 해제했습니다.");
}

export async function updateWatchlistAlertPreference(formData: FormData) {
  const preference = parseAlertPreference(formData);
  if (!preference) redirectWithStatus("/watchlist", "error", "올바르지 않은 알림 설정입니다.");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/watchlist")}`);
  await requirePolicyConsents(supabase, user.id, "/watchlist");

  try {
    await updateAlertPreference(new SupabaseAlertPreferenceRepository(supabase), user.id, preference);
  } catch {
    redirectWithStatus("/watchlist", "error", "알림 설정을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  revalidatePath("/watchlist");
  redirectWithStatus("/watchlist", "message", "알림 설정을 저장했습니다.");
}

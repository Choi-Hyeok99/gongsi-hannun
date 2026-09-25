import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readServerEnvironment } from "@/server/env";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type AccountOverview = Readonly<{
  email: string;
  createdAt: string;
  providers: readonly string[];
  watchlistCount: number;
  activePushSubscriptionCount: number;
}>;

export async function getCurrentAccountOverview(): Promise<AccountOverview | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const [watchlistResult, pushResult] = await Promise.all([
    supabase
      .from("watchlist_companies")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("web_push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("disabled_at", null),
  ]);

  const providerValues = Array.isArray(user.app_metadata.providers)
    ? user.app_metadata.providers
    : user.app_metadata.provider
      ? [user.app_metadata.provider]
      : [];

  return {
    email: user.email,
    createdAt: user.created_at,
    providers: providerValues.filter((provider): provider is string => typeof provider === "string"),
    watchlistCount: watchlistResult.count ?? 0,
    activePushSubscriptionCount: pushResult.count ?? 0,
  };
}

export function createSupabaseAdminClient() {
  const environment = readServerEnvironment();
  return createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

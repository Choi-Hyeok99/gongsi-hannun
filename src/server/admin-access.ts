import "server-only";
import { isAdminUser } from "@/domain/admin-access";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type AdminAccess = "ADMIN" | "SIGN_IN" | "FORBIDDEN";
export async function readAdminAccess(): Promise<AdminAccess> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return "SIGN_IN";
    return isAdminUser(user.id, process.env.ADMIN_USER_IDS) ? "ADMIN" : "FORBIDDEN";
  } catch { return "SIGN_IN"; }
}

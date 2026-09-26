"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotificationCenterRepository } from "@/data/supabase-notification-center-repository";
import { readAllNotifications, readNotification } from "@/server/notification-center-use-cases";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requirePolicyConsents } from "@/server/consent";

async function requireUser(next: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  await requirePolicyConsents(supabase, user.id, next);
  return user;
}

export async function openNotification(formData: FormData) {
  const id = formData.get("notificationId");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) redirect("/notifications?error=invalid");
  const user = await requireUser("/notifications");
  const notification = await readNotification(createNotificationCenterRepository(), user.id, id);
  if (!notification) redirect("/notifications?error=missing");
  revalidatePath("/notifications");
  redirect(`/disclosures/${notification.receiptNumber}`);
}

export async function markAllNotificationsRead() {
  const user = await requireUser("/notifications");
  await readAllNotifications(createNotificationCenterRepository(), user.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

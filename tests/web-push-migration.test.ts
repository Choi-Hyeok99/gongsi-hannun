import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/202609150001_add_web_push_notifications.sql", "utf8");

describe("web push migration", () => {
  it("stores one subscription endpoint owner and one delivery per notification and device", () => {
    expect(migration).toContain("endpoint text not null unique");
    expect(migration).toContain("primary key (notification_id, subscription_id)");
    expect(migration).toContain("minimum_importance_score smallint not null default 85");
  });

  it("uses authenticated RPCs instead of accepting a user id", () => {
    expect(migration).toContain("current_user_id uuid := auth.uid()");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("grant execute on function public.register_web_push_subscription");
    expect(migration).not.toContain("p_user_id");
  });

  it("keeps delivery records service-role only", () => {
    expect(migration).toContain("alter table public.web_push_deliveries force row level security");
    expect(migration).toContain("to service_role");
  });
});

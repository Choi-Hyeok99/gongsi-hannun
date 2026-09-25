import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_REAUTH_WINDOW_MS,
  connectedLoginMethods,
  hasRecentAuthentication,
  parseDeleteAccountForm,
} from "@/domain/account";
import {
  hasCurrentRequiredPolicies,
  parseRequiredPolicyAgreement,
  REQUIRED_POLICY_VERSIONS,
  requiredPolicyRows,
} from "@/domain/consent";

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("required policy consent", () => {
  it("requires both explicit checkboxes", () => {
    expect(parseRequiredPolicyAgreement(form({ termsAccepted: "on" }))).toEqual({
      success: false,
      message: "이용약관과 개인정보처리방침에 모두 동의해 주세요.",
    });
  });

  it("recognizes only the current required versions", () => {
    const rows = requiredPolicyRows("user-id");
    expect(hasCurrentRequiredPolicies(rows)).toBe(true);
    expect(hasCurrentRequiredPolicies([
      { policy_type: "TERMS", version: REQUIRED_POLICY_VERSIONS.TERMS },
      { policy_type: "PRIVACY", version: "old" },
    ])).toBe(false);
  });
});

describe("account deletion confirmation", () => {
  const valid = {
    emailConfirmation: "user@example.com",
    deleteConfirmation: "탈퇴",
    irreversibleConfirmed: "on",
  };

  it("requires the current email", () => {
    const result = parseDeleteAccountForm(
      form({ ...valid, emailConfirmation: "other@example.com" }),
      "user@example.com",
    );
    expect(result.success).toBe(false);
  });

  it("requires the exact Korean confirmation and irreversible checkbox", () => {
    expect(parseDeleteAccountForm(
      form({ ...valid, deleteConfirmation: "delete" }),
      "user@example.com",
    ).success).toBe(false);
    expect(parseDeleteAccountForm(
      form({ ...valid, irreversibleConfirmed: "" }),
      "user@example.com",
    ).success).toBe(false);
  });

  it("accepts all three confirmations", () => {
    expect(parseDeleteAccountForm(form(valid), "USER@example.com")).toEqual({
      success: true,
      data: { emailConfirmation: "user@example.com" },
    });
  });
});

describe("connected login methods", () => {
  it("shows Kakao even when email is the primary provider", () => {
    expect(connectedLoginMethods({ provider: "email", providers: ["email", "kakao"] })).toEqual(["이메일", "카카오"]);
  });

  it("does not invent a provider when metadata is missing", () => {
    expect(connectedLoginMethods(undefined)).toEqual([]);
  });
});

describe("account deletion reauthentication", () => {
  const now = Date.parse("2026-09-26T00:20:00.000Z");

  it("accepts authentication inside the ten minute window", () => {
    expect(hasRecentAuthentication("2026-09-26T00:10:00.000Z", now)).toBe(true);
    expect(ACCOUNT_DELETION_REAUTH_WINDOW_MS).toBe(10 * 60 * 1000);
  });

  it("rejects missing, stale, invalid, and future timestamps", () => {
    expect(hasRecentAuthentication(undefined, now)).toBe(false);
    expect(hasRecentAuthentication("2026-09-26T00:09:59.999Z", now)).toBe(false);
    expect(hasRecentAuthentication("invalid", now)).toBe(false);
    expect(hasRecentAuthentication("2026-09-26T00:20:00.001Z", now)).toBe(false);
  });
});

describe("account privacy migration", () => {
  const sql = readFileSync(
    "supabase/migrations/202609260001_add_user_consents_and_account_deletion_guards.sql",
    "utf8",
  );

  it("stores versioned consents with ownership RLS", () => {
    expect(sql).toContain("create table public.user_consents");
    expect(sql).toContain("references auth.users(id) on delete cascade");
    expect(sql).toContain("alter table public.user_consents force row level security");
    expect(sql).toContain("user_consents_select_own");
    expect(sql).toContain("user_consents_insert_own");
  });

  it("asserts every direct and indirect deletion cascade", () => {
    for (const table of [
      "public.profiles",
      "public.watchlist_companies",
      "public.watchlist_alert_settings",
      "public.in_app_notifications",
      "public.web_push_subscriptions",
      "public.web_push_deliveries",
    ]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("direct_cascade_count <> 6");
    expect(sql).toContain("delivery_cascade_count <> 2");
  });
});

describe("account deletion action contract", () => {
  const source = readFileSync("src/app/account/actions.ts", "utf8");

  it("derives the deletion target from the authenticated user only", () => {
    expect(source).toContain("supabase.auth.getUser()");
    expect(source).toContain("admin.auth.admin.deleteUser(user.id)");
    expect(source).not.toContain('formData.get("userId")');
  });

  it("signs out only after a successful admin deletion", () => {
    expect(source.indexOf("admin.auth.admin.deleteUser(user.id)")).toBeLessThan(
      source.indexOf("supabase.auth.signOut()"),
    );
  });

  it("requires a recent login before validating or deleting", () => {
    expect(source).toContain("hasRecentAuthentication(user.last_sign_in_at)");
    expect(source).toContain("탈퇴 전 본인 확인을 위해 다시 로그인해 주세요.");
    expect(source.indexOf("hasRecentAuthentication(user.last_sign_in_at)")).toBeLessThan(
      source.indexOf("parseDeleteAccountForm(formData, user.email)"),
    );
  });
});

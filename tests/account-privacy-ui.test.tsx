import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => <header /> }));
vi.mock("@/app/auth/actions", () => ({ signUp: vi.fn(), loginWithKakao: vi.fn(), logout: vi.fn() }));
vi.mock("@/app/account/actions", () => ({ deleteAccount: vi.fn() }));
vi.mock("@/app/consent/actions", () => ({ acceptRequiredPolicies: vi.fn() }));
vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "test@example.com", created_at: "2026-09-20T00:00:00Z", app_metadata: { provider: "email" } } } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => table === "watchlist_companies"
          ? Promise.resolve({ count: 2, error: null })
          : { is: () => Promise.resolve({ count: 1, error: null }) },
      }),
    }),
  }),
}));

import AccountPage from "@/app/account/page";
import ConsentPage from "@/app/consent/page";
import PrivacyPage from "@/app/privacy/page";
import SignUpPage from "@/app/signup/page";
import TermsPage from "@/app/terms/page";
import { SiteFooter } from "@/components/SiteFooter";

describe("account and policy UI", () => {
  it("keeps glossary separate from public policy links", () => {
    const markup = renderToStaticMarkup(<SiteFooter />);
    expect(markup).toContain('href="/guide/terms"');
    expect(markup).toContain('href="/terms"');
    expect(markup).toContain('href="/privacy"');
    expect(readFileSync("src/components/SiteHeader.tsx", "utf8")).toContain('<Link href="/account">내 정보</Link>');
  });

  it("marks unresolved legal details as pre-release requirements", () => {
    const terms = renderToStaticMarkup(<TermsPage />);
    const privacy = renderToStaticMarkup(<PrivacyPage />);
    expect(terms).toContain("운영자명");
    expect(terms).toContain("정식 공개 전 확정 필요");
    expect(privacy).toContain("국외이전");
    expect(privacy).toContain("정식 공개 전 확정 필요");
  });

  it("requires separate policy checkboxes in email signup and consent", async () => {
    const signup = renderToStaticMarkup(await SignUpPage({ searchParams: Promise.resolve({}) }));
    const consent = renderToStaticMarkup(await ConsentPage({ searchParams: Promise.resolve({}) }));
    for (const markup of [signup, consent]) {
      expect(markup).toContain('name="termsAccepted"');
      expect(markup).toContain('name="privacyAccepted"');
      expect(markup.match(/type="checkbox"[^>]*required=""/g)).toHaveLength(2);
    }
  });

  it("shows own account counts and a deliberate deletion confirmation", async () => {
    const markup = renderToStaticMarkup(await AccountPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain("test@example.com");
    expect(markup).toContain("관심기업");
    expect(markup).toContain("활성 푸시 기기");
    expect(markup).toContain('name="emailConfirmation"');
    expect(markup).toContain('name="deleteConfirmation"');
    expect(markup).toContain('name="irreversibleConfirmed"');
  });

  it("includes narrow-screen policy and account layout rules", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(".account-grid, .account-danger { grid-template-columns: 1fr; }");
    expect(css).toContain(".policy-content section { padding: 18px; }");
  });
});

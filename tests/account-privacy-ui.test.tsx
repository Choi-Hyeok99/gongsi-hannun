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

  it("publishes confirmed contact details and discloses actual storage and guest cookies", () => {
    const terms = renderToStaticMarkup(<TermsPage />);
    const privacy = renderToStaticMarkup(<PrivacyPage />);
    for (const markup of [terms, privacy]) {
      expect(markup).toContain("최혁");
      expect(markup).toContain("gur0709@naver.com");
      expect(markup).toContain("2026-10-12");
      expect(markup).not.toMatch(/검토 초안|확정 필요|미확정/);
    }
    expect(terms).toContain("고의·중대한 과실");
    expect(privacy).toContain("ap-northeast-2");
    expect(privacy).toContain("국외 처리");
    expect(privacy).toContain("gongsi-ai-preview");
    expect(privacy).toContain("180일");
  });

  it("requires age, terms agreement, and privacy acknowledgement in email signup and consent", async () => {
    const signup = renderToStaticMarkup(await SignUpPage({ searchParams: Promise.resolve({}) }));
    const consent = renderToStaticMarkup(await ConsentPage({ searchParams: Promise.resolve({}) }));
    for (const markup of [signup, consent]) {
      expect(markup).toContain('name="termsAccepted"');
      expect(markup).toContain('name="privacyAcknowledged"');
      expect(markup).toContain('name="ageConfirmed"');
      expect(markup.match(/type="checkbox"[^>]*required=""/g)).toHaveLength(3);
      expect(markup).not.toContain("개인정보 처리방침</a>을 확인하고 동의합니다");
      expect(markup).not.toMatch(/확정 필요|미확정/);
    }
  });

  it("keeps the selected disclosure return path for email and Kakao signup", async () => {
    const markup = renderToStaticMarkup(await SignUpPage({ searchParams: Promise.resolve({next: "/disclosures/20260923800549"}) }));
    expect(markup.match(/name="next" value="\/disclosures\/20260923800549"/g)).toHaveLength(2);
    const invalid = renderToStaticMarkup(await SignUpPage({ searchParams: Promise.resolve({next: "https://evil.invalid"}) }));
    expect(invalid).not.toContain("evil.invalid");
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

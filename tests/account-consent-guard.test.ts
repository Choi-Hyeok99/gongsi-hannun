import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  hasConsents: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/server/supabase/config", () => ({
  readPublicSupabaseEnvironment: () => ({ url: "https://example.supabase.co", publishableKey: "publishable-test-key" }),
}));
vi.mock("@/server/consent", () => ({ hasRequiredPolicyConsents: mocks.hasConsents }));

import { refreshAuthSession } from "@/server/supabase/middleware";

describe("existing-session policy consent guard", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.hasConsents.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.hasConsents.mockResolvedValue(false);
  });

  it("redirects an unconsented signed-in GET and preserves its destination", async () => {
    const response = await refreshAuthSession(new NextRequest("https://preview.example/companies/005930?period=1M"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://preview.example/consent?next=%2Fcompanies%2F005930%3Fperiod%3D1M",
    );
  });

  it.each(["/terms", "/privacy", "/consent", "/login", "/auth/callback"])(
    "keeps %s reachable before consent",
    async (path) => {
      const response = await refreshAuthSession(new NextRequest(`https://preview.example${path}`));
      expect(response.headers.get("location")).toBeNull();
      expect(mocks.hasConsents).not.toHaveBeenCalled();
    },
  );

  it("does not intercept POST actions such as logout", async () => {
    const response = await refreshAuthSession(new NextRequest("https://preview.example/account", { method: "POST" }));
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.hasConsents).not.toHaveBeenCalled();
  });

  it("does not redirect an anonymous visitor", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await refreshAuthSession(new NextRequest("https://preview.example/search"));
    expect(response.headers.get("location")).toBeNull();
  });
});

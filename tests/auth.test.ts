import { describe, expect, it } from "vitest";
import { buildAuthCallbackUrl, buildTrustedSiteUrl, parseEmailForm, parseLoginForm, parsePasswordUpdateForm, parseSignUpForm, safeRedirectPath } from "@/domain/auth";

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("authentication input validation", () => {
  it("normalizes a valid login email", () => {
    expect(parseLoginForm(form({ email: " USER@Example.COM ", password: "secret" }))).toEqual({
      success: true,
      data: { email: "user@example.com", password: "secret" },
    });
  });

  it("rejects invalid reset email input", () => {
    expect(parseEmailForm(form({ email: "invalid" })).success).toBe(false);
  });

  it("requires a strong minimum password length for signup", () => {
    const result = parseSignUpForm(form({ email: "user@example.com", password: "short", passwordConfirmation: "short" }));
    expect(result).toEqual({ success: false, message: "비밀번호는 12자 이상이어야 합니다." });
  });

  it("rejects mismatched password confirmation", () => {
    const result = parsePasswordUpdateForm(form({
      password: "correct-password",
      passwordConfirmation: "different-password",
    }));
    expect(result).toEqual({ success: false, message: "비밀번호 확인이 일치하지 않습니다." });
  });

  it("requires age confirmation before signup", () => {
    const result = parseSignUpForm(form({
      email: "user@example.com",
      password: "correct-password",
      passwordConfirmation: "correct-password",
      termsAccepted: "on",
      privacyAcknowledged: "on",
    }));
    expect(result).toEqual({
      success: false,
      message: "만 14세 이상만 회원가입할 수 있습니다.",
    });
  });

  it("accepts signup when age and required policies are confirmed", () => {
    const result = parseSignUpForm(form({
      email: "USER@example.com",
      password: "correct-password",
      passwordConfirmation: "correct-password",
      ageConfirmed: "on",
      termsAccepted: "on",
      privacyAcknowledged: "on",
    }));
    expect(result).toEqual({
      success: true,
      data: {
        email: "user@example.com",
        password: "correct-password",
        passwordConfirmation: "correct-password",
        ageConfirmed: true,
        termsAccepted: true,
        privacyAcknowledged: true,
      },
    });
  });
});

describe("safeRedirectPath", () => {
  it("allows an internal path", () => expect(safeRedirectPath("/companies/005930")).toBe("/companies/005930"));
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/\n/evil.example", "/\t/evil.example", null])("rejects unsafe redirect %s", (value) => {
    expect(safeRedirectPath(value)).toBe("/");
  });
});

describe("buildAuthCallbackUrl", () => {
  it("preserves a safe post-login destination", () => {
    expect(buildAuthCallbackUrl("https://example.com", "/watchlist")).toBe(
      "https://example.com/auth/callback?next=%2Fwatchlist",
    );
  });

  it("drops an external post-login destination", () => {
    expect(buildAuthCallbackUrl("https://example.com", "https://evil.example")).toBe(
      "https://example.com/auth/callback",
    );
  });
});

describe("buildTrustedSiteUrl", () => {
  it("uses the configured public site instead of a proxy request origin", () => {
    expect(buildTrustedSiteUrl("https://preview.example", "/watchlist")).toBe("https://preview.example/watchlist");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/\n/evil.example", "/\t/evil.example"])("rejects unsafe post-login destination %s", (path) => {
    expect(buildTrustedSiteUrl("https://preview.example", path)).toBe("https://preview.example/");
  });
});

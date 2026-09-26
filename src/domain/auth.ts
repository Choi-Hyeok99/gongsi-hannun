export type LoginInput = Readonly<{
  email: string;
  password: string;
}>;

export type SignUpInput = LoginInput & Readonly<{
  passwordConfirmation: string;
  termsAccepted: true;
  privacyAcknowledged: true;
  ageConfirmed: true;
}>;

export type PasswordUpdateInput = Readonly<{
  password: string;
  passwordConfirmation: string;
}>;

export type ValidationResult<T> =
  | Readonly<{ success: true; data: T }>
  | Readonly<{ success: false; message: string }>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINIMUM_PASSWORD_LENGTH = 12;

function normalizeEmail(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readPassword(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function validateEmail(email: string): string | null {
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return "올바른 이메일 주소를 입력해 주세요.";
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    return `비밀번호는 ${MINIMUM_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  }
  if (password.length > 72) {
    return "비밀번호는 72자 이하여야 합니다.";
  }
  return null;
}

export function parseLoginForm(formData: FormData): ValidationResult<LoginInput> {
  const email = normalizeEmail(formData.get("email"));
  const password = readPassword(formData.get("password"));
  const message = validateEmail(email) ?? (password ? null : "비밀번호를 입력해 주세요.");

  return message
    ? { success: false, message }
    : { success: true, data: { email, password } };
}

export function parseEmailForm(formData: FormData): ValidationResult<Readonly<{ email: string }>> {
  const email = normalizeEmail(formData.get("email"));
  const message = validateEmail(email);
  return message ? { success: false, message } : { success: true, data: { email } };
}

export function parseSignUpForm(formData: FormData): ValidationResult<SignUpInput> {
  const email = normalizeEmail(formData.get("email"));
  const password = readPassword(formData.get("password"));
  const passwordConfirmation = readPassword(formData.get("passwordConfirmation"));
  const termsAccepted = formData.get("termsAccepted") === "on";
  const privacyAcknowledged = formData.get("privacyAcknowledged") === "on";
  const ageConfirmed = formData.get("ageConfirmed") === "on";
  const message = validateEmail(email)
    ?? validatePassword(password)
    ?? (password === passwordConfirmation ? null : "비밀번호 확인이 일치하지 않습니다.")
    ?? (ageConfirmed ? null : "만 14세 이상만 회원가입할 수 있습니다.")
    ?? (termsAccepted ? null : "이용약관에 동의해 주세요.")
    ?? (privacyAcknowledged ? null : "개인정보 처리방침을 확인해 주세요.");

  return message
    ? { success: false, message }
    : {
      success: true,
      data: { email, password, passwordConfirmation, termsAccepted: true, privacyAcknowledged: true, ageConfirmed: true },
    };
}

export function parsePasswordUpdateForm(formData: FormData): ValidationResult<PasswordUpdateInput> {
  const password = readPassword(formData.get("password"));
  const passwordConfirmation = readPassword(formData.get("passwordConfirmation"));
  const message = validatePassword(password)
    ?? (password === passwordConfirmation ? null : "비밀번호 확인이 일치하지 않습니다.");

  return message
    ? { success: false, message }
    : { success: true, data: { password, passwordConfirmation } };
}

export function safeRedirectPath(value: string | null, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\x00-\x1f\x7f]/.test(value)) {
    return fallback;
  }
  return value;
}

export function buildAuthCallbackUrl(siteUrl: string, next: string | null): string {
  const callbackUrl = new URL("/auth/callback", siteUrl);
  const destination = safeRedirectPath(next);
  if (destination !== "/") callbackUrl.searchParams.set("next", destination);
  return callbackUrl.toString();
}

export function buildTrustedSiteUrl(siteUrl: string, path: string | null): string {
  return new URL(safeRedirectPath(path), siteUrl).toString();
}

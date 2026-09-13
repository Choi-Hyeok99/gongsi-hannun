import { InvalidInputError } from "@/domain/errors";
import { COMPANY_INDUSTRY_CATEGORIES, type CompanyIndustryCategory } from "@/domain/company";

const STOCK_CODE = /^[0-9]{6}$/;

export function normalizeCompanyQuery(value: string | null): string {
  const query = value?.normalize("NFKC").trim() ?? "";
  if (query.length < 1 || query.length > 60) {
    throw new InvalidInputError("기업명 또는 6자리 종목코드를 입력해 주세요.");
  }
  if (/^[0-9]+$/.test(query) && !STOCK_CODE.test(query)) {
    throw new InvalidInputError("종목코드는 6자리 숫자여야 합니다.");
  }
  return query;
}

export function normalizeCompanyCategory(value: string | null): CompanyIndustryCategory | undefined {
  const category = value?.normalize("NFKC").trim().toUpperCase() ?? "";
  if (!category) return undefined;
  if (!COMPANY_INDUSTRY_CATEGORIES.some((candidate) => candidate === category)) {
    throw new InvalidInputError("올바른 기업 업종 카테고리를 선택해 주세요.");
  }
  return category as CompanyIndustryCategory;
}

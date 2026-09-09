import Link from "next/link";
import type { PublicCompany } from "@/server/company-use-cases";

export function CompanyResultCard({ company }: Readonly<{ company: PublicCompany }>) {
  const market = company.market === "OTHER" ? "시장 정보 준비 중" : company.market;
  return (
    <Link className="company-result" href={`/companies/${company.stockCode}`}>
      <span className="company-avatar company-avatar--large" aria-hidden="true">{company.name.slice(0, 1)}</span>
      <span className="company-result__body">
        <span className="company-result__title">
          <strong>{company.name}</strong>
          <span className={company.industryCategory === "UNCLASSIFIED" ? "industry-badge industry-badge--muted" : "industry-badge"}>
            {company.industryCategoryLabel ?? "미분류"}
          </span>
        </span>
        <span>{company.stockCode} · {market}</span>
        <small>{company.sector ?? "세부 업종 미분류"}</small>
      </span>
      <span className="card-arrow" aria-hidden="true">→</span>
    </Link>
  );
}

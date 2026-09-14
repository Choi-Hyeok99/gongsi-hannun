import Link from "next/link";
import { DailyPriceChart } from "@/components/DailyPriceChart";
import type { DailyPriceSnapshot } from "@/domain/daily-price";
import type { PublicCompany } from "@/server/company-use-cases";

export function CompanyResultCard({ company, snapshot }: Readonly<{ company: PublicCompany; snapshot: DailyPriceSnapshot }>) {
  const market = company.market === "OTHER" ? "시장 미분류" : company.market;
  const industryLabel = company.industryCategory === "UNCLASSIFIED" ? "업종 미분류" : company.industryCategoryLabel ?? "업종 미분류";
  return (
    <Link className="company-result" href={`/companies/${company.stockCode}`}>
      <span className="company-result__heading">
        <span className="company-avatar" aria-hidden="true">{company.name.slice(0, 1)}</span>
        <span className="company-result__body">
          <span className="company-result__title">
            <strong>{company.name}</strong>
            <span className={company.industryCategory === "UNCLASSIFIED" ? "industry-badge industry-badge--muted" : "industry-badge"}>
              {industryLabel}
            </span>
          </span>
          <span>{company.stockCode} · {market}</span>
          {company.sector ? <small>{company.sector}</small> : null}
        </span>
        <span className="card-arrow" aria-hidden="true">→</span>
      </span>
      <DailyPriceChart companyName={company.name} snapshot={snapshot} compact />
    </Link>
  );
}

import Link from "next/link";
import type { DisclosureSummary } from "@/domain/disclosure-query";

type Props = Readonly<{
  disclosures: readonly DisclosureSummary[];
  emptyMessage?: string;
}>;

export function DisclosureList({ disclosures, emptyMessage = "표시할 공시가 없습니다." }: Props) {
  if (disclosures.length === 0) {
    return (
      <div className="empty-state">
        <strong>{emptyMessage}</strong>
        <p>새 공시가 수집되면 이곳에 바로 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="disclosure-list">
      {disclosures.map((disclosure) => (
        <Link
          className="disclosure-card"
          href={`/disclosures/${disclosure.receiptNumber}`}
          key={disclosure.receiptNumber}
        >
          <time dateTime={disclosure.disclosedOn}>{formatDate(disclosure.disclosedOn)}</time>
          <div className="disclosure-card__body">
            <div className="disclosure-card__meta">
              <strong>{disclosure.company.name}</strong>
              <span>{disclosure.company.market}</span>
              {disclosure.status === "REVIEW_REQUIRED" ? <span className="status-badge">정정 확인</span> : null}
            </div>
            <h3>{disclosure.reportName}</h3>
            <small>{disclosure.filerName ?? disclosure.company.name}</small>
          </div>
          <span className="card-arrow" aria-hidden="true">→</span>
        </Link>
      ))}
    </div>
  );
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${year?.slice(2)}.${month}.${day}`;
}

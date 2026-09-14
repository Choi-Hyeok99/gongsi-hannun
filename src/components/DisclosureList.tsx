import Link from "next/link";
import React from "react";
import type { DisclosureSummary } from "@/domain/disclosure-query";
import { getDisclosureEventTypeLabel } from "@/domain/disclosure-classification";

type Props = Readonly<{
  disclosures: readonly DisclosureSummary[];
  emptyState?: Readonly<{
    title: string;
    description: string;
    action?: Readonly<{ href: string; label: string }>;
  }>;
}>;

const DEFAULT_EMPTY_STATE = {
  title: "현재 표시할 공개 공시가 없습니다.",
  description: "수집이 완료된 공개 공시가 생기면 이 목록에 표시됩니다.",
} as const;

export function DisclosureList({ disclosures, emptyState = DEFAULT_EMPTY_STATE }: Props) {
  if (disclosures.length === 0) {
    return (
      <div className="empty-state">
        <strong>{emptyState.title}</strong>
        <p>{emptyState.description}</p>
        {emptyState.action ? <Link className="primary-link" href={emptyState.action.href}>{emptyState.action.label}</Link> : null}
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
              <span className="event-type-badge">{getDisclosureEventTypeLabel(disclosure.eventType)}</span>
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

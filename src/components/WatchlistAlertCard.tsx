import React from "react";
import Link from "next/link";
import { updateWatchlistAlertPreference } from "@/app/watchlist/actions";
import {
  getDisclosureEventTypeLabel,
  type DisclosureEventType,
} from "@/domain/disclosure-classification";
import {
  BROAD_ALERT_MINIMUM_SCORE,
  DEFAULT_ALERT_EVENT_TYPES,
  DEFAULT_ALERT_MINIMUM_SCORE,
  STRICT_ALERT_MINIMUM_SCORE,
  type AlertPreference,
} from "@/domain/notification-center";
import type { WatchlistCompany } from "@/domain/watchlist";

const EDITABLE_EVENT_TYPES: readonly DisclosureEventType[] = DEFAULT_ALERT_EVENT_TYPES;

export function WatchlistAlertCard({
  company,
  preference,
}: Readonly<{ company: WatchlistCompany; preference?: AlertPreference }>) {
  const selectedTypes = preference?.eventTypes ?? DEFAULT_ALERT_EVENT_TYPES;
  const enabled = preference?.enabled ?? true;
  const score = preference?.minimumImportanceScore ?? DEFAULT_ALERT_MINIMUM_SCORE;
  const statusLabel = enabled ? `${score}점 이상` : "알림 꺼짐";

  return (
    <article className="watchlist-alert-card">
      <div className="watchlist-alert-card__company">
        <span className="company-avatar company-avatar--large" aria-hidden="true">{company.name.slice(0, 1)}</span>
        <div>
          <div className="watchlist-alert-card__title-row">
            <Link href={`/companies/${company.stockCode}`}><strong>{company.name}</strong></Link>
            <span className={`alert-status-badge${enabled ? "" : " alert-status-badge--off"}`}>{statusLabel}</span>
          </div>
          <p>{company.stockCode} · {company.market === "OTHER" ? "시장 미분류" : company.market}</p>
        </div>
      </div>
      <form action={updateWatchlistAlertPreference} className="alert-preference-form">
        <input type="hidden" name="companyId" value={company.id} />
        <label className="alert-toggle">
          <input type="checkbox" name="enabled" value="true" defaultChecked={enabled} />
          <span>중요 공시 알림</span>
        </label>
        <label>
          알림 강도
          <select name="minimumImportanceScore" defaultValue={score >= STRICT_ALERT_MINIMUM_SCORE ? "85" : score <= BROAD_ALERT_MINIMUM_SCORE ? "60" : "70"}>
            <option value="60">넓게 받기 · 60점 이상</option>
            <option value="70">기본 추천 · 70점 이상</option>
            <option value="85">핵심만 받기 · 85점 이상</option>
          </select>
        </label>
        <details>
          <summary>공시 유형 세부 선택</summary>
          <div className="alert-event-types">
            {EDITABLE_EVENT_TYPES.map((eventType) => (
              <label key={eventType}>
                <input type="checkbox" name="eventTypes" value={eventType} defaultChecked={selectedTypes.includes(eventType)} />
                <span>{getDisclosureEventTypeLabel(eventType)}</span>
              </label>
            ))}
          </div>
          <small>선택하지 않으면 점수 기준을 충족한 모든 유형을 알려드립니다.</small>
        </details>
        <button type="submit">설정 저장</button>
        <small className="alert-preference-form__hint">사이트 내 알림은 선택한 기준으로, 기기 푸시는 그중 85점 이상 핵심 공시만 전송됩니다.</small>
      </form>
    </article>
  );
}

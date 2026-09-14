import Link from "next/link";
import { updateWatchlistAlertPreference } from "@/app/watchlist/actions";
import {
  getDisclosureEventTypeLabel,
  type DisclosureEventType,
} from "@/domain/disclosure-classification";
import {
  DEFAULT_ALERT_EVENT_TYPES,
  DEFAULT_ALERT_MINIMUM_SCORE,
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

  return (
    <article className="watchlist-alert-card">
      <div className="watchlist-alert-card__company">
        <span className="company-avatar company-avatar--large" aria-hidden="true">{company.name.slice(0, 1)}</span>
        <div>
          <Link href={`/companies/${company.stockCode}`}><strong>{company.name}</strong></Link>
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
          <select name="minimumImportanceScore" defaultValue={score >= 85 ? "85" : "70"}>
            <option value="70">주요 공시 · 70점 이상</option>
            <option value="85">매우 중요 · 85점 이상</option>
          </select>
        </label>
        <details>
          <summary>알림 유형 선택</summary>
          <div className="alert-event-types">
            {EDITABLE_EVENT_TYPES.map((eventType) => (
              <label key={eventType}>
                <input type="checkbox" name="eventTypes" value={eventType} defaultChecked={selectedTypes.includes(eventType)} />
                <span>{getDisclosureEventTypeLabel(eventType)}</span>
              </label>
            ))}
          </div>
          <small>선택하지 않으면 중요도 기준을 충족한 모든 유형을 알려드립니다.</small>
        </details>
        <button type="submit">설정 저장</button>
      </form>
    </article>
  );
}

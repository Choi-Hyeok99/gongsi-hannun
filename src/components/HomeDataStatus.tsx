import React from "react";
import { DISCLOSURE_COLLECTION_INTERVAL_MINUTES, type DisclosureCollectionState, type HomeOperationalStatus } from "@/domain/home-status";

const stateLabels: Readonly<Record<DisclosureCollectionState, string>> = {
  CURRENT: "정상 수집 중",
  DELAYED: "수집 지연 확인 필요",
  OUTSIDE_COLLECTION_HOURS: "수집 시간 외",
  UNAVAILABLE: "상태 확인 불가",
};

export function HomeDisclosureCollectionStatus({ status }: Readonly<{ status: HomeOperationalStatus }>) {
  const collectedAt = formatCollectedAt(status.lastSuccessfulDisclosureCollectionAt);
  return (
    <div className="home-collection-status" data-state={status.disclosureCollectionState}>
      <p>
        <span className="home-collection-status__indicator" aria-hidden="true" />
        <strong>{collectedAt ? `최근 성공 수집 ${collectedAt}` : "최근 수집 시각 확인 불가"}</strong>
        <span>{stateLabels[status.disclosureCollectionState]}</span>
      </p>
      <small>공시 데이터는 평일 08:00~20:59에 {DISCLOSURE_COLLECTION_INTERVAL_MINUTES}분 간격으로 수집합니다.</small>
    </div>
  );
}

export function HomeCompanyCount({ count }: Readonly<{ count: number | null }>) {
  return count === null ? (
    <>
      <h2>집계 정보 없음</h2>
      <p>현재 연결된 상장기업 수를 확인할 수 없습니다.</p>
    </>
  ) : (
    <>
      <h2>{count.toLocaleString("ko-KR")}개 상장기업 정보를 연결했습니다</h2>
      <p>현재 데이터베이스에서 조회한 KOSPI·KOSDAQ 활성 상장기업 수입니다.</p>
    </>
  );
}

function formatCollectedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

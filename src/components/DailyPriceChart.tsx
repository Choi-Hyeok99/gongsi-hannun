import React from "react";
import { DAILY_PRICE_SOURCE_ID, type DailyPriceSnapshot } from "@/domain/daily-price";

type Props = Readonly<{
  companyName: string;
  snapshot: DailyPriceSnapshot;
  compact?: boolean;
}>;

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = 12;
export function DailyPriceChart({ companyName, snapshot, compact = false }: Props) {
  if (snapshot.status === "ERROR") {
    return (
      <div className={compact ? "price-empty price-empty--compact" : "price-empty"}>
        <strong>주가 데이터 조회 오류</strong>
        {!compact && <p>KRX 일별 종가를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>}
      </div>
    );
  }
  if (snapshot.status === "NO_DATA" || !snapshot.latest) {
    return (
      <div className={compact ? "price-empty price-empty--compact" : "price-empty"}>
        <strong>수집된 KRX 일별 종가 없음</strong>
        {!compact && <p>현재 이 종목에 저장된 한국거래소 일별 종가가 없습니다.</p>}
      </div>
    );
  }

  const direction = snapshot.changeAmount !== null && snapshot.changeAmount > 0 ? "up" : snapshot.changeAmount !== null && snapshot.changeAmount < 0 ? "down" : "flat";
  const hasComparison = Boolean(snapshot.previous && snapshot.points.length >= 2 && snapshot.changeAmount !== null);
  const path = buildLinePath(snapshot.points.map((point) => point.closePrice), WIDTH, HEIGHT, PADDING);
  const firstDate = formatDate(snapshot.points[0]?.tradingDate);
  const latestDate = formatDate(snapshot.latest.tradingDate);

  return (
    <div className={compact ? "price-chart price-chart--compact" : "price-chart"}>
      <div className="price-chart__summary">
        <strong>{formatWon(snapshot.latest.closePrice)}</strong>
        {hasComparison && snapshot.previous && snapshot.changeAmount !== null ? (
          <span className={`price-change price-change--${direction}`}>
            직전 거래일({formatDate(snapshot.previous.tradingDate)}) 대비 {formatChange(snapshot.changeAmount, snapshot.changeRate)}
          </span>
        ) : null}
      </div>
      {hasComparison ? (
        <svg
          className="price-chart__svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${companyName} ${snapshot.period} 일별 종가 그래프. ${firstDate}부터 ${latestDate}까지, 최근 종가 ${formatWon(snapshot.latest.closePrice)}`}
        >
          <path className={`price-chart__line price-chart__line--${direction}`} d={path} vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
      {!compact && hasComparison && (
        <div className="price-chart__axis" aria-hidden="true">
          <span>{firstDate}</span>
          <span>{latestDate}</span>
        </div>
      )}
      <small className="price-chart__notice">{getPriceNotice(snapshot, compact)}</small>
      {!compact && snapshot.sourceId === DAILY_PRICE_SOURCE_ID && (
        <small className="price-chart__source">출처: 한국거래소 통계정보</small>
      )}
    </div>
  );
}

export function buildLinePath(values: readonly number[], width: number, height: number, padding: number): string {
  if (values.length < 2) return "";
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  return values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = padding + ((maximum - value) / range) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function formatWon(value: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatChange(amount: number, rate: number | null): string {
  const prefix = amount > 0 ? "+" : "";
  const direction = amount > 0 ? "▲" : amount < 0 ? "▼" : "–";
  const rateLabel = rate === null ? "" : ` (${prefix}${rate.toFixed(2)}%)`;
  return `${direction} ${prefix}${new Intl.NumberFormat("ko-KR").format(amount)}원${rateLabel}`;
}

function formatDate(value: string | undefined): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year.slice(2)}.${month}.${day}` : value;
}

function getPriceNotice(snapshot: DailyPriceSnapshot, compact: boolean): string {
  const latestDate = formatDate(snapshot.latest?.tradingDate);
  if (snapshot.status === "INSUFFICIENT_HISTORY") return `기준일 ${latestDate} · 비교 가능한 직전 거래일 데이터 없음`;
  if (snapshot.status === "STALE") return `기준일 ${latestDate} · 최신 일별 종가 수집 지연`;
  return compact ? `기준일 ${latestDate} · 최근 1개월 일별 종가 · KRX` : `기준일 ${latestDate} · 일별 종가 · 실시간 시세 아님`;
}

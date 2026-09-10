import React from "react";
import type { DailyPriceSnapshot } from "@/domain/daily-price";

type Props = Readonly<{
  companyName: string;
  snapshot: DailyPriceSnapshot;
  compact?: boolean;
}>;

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = 12;
const KRX_DAILY_SOURCE = "KRX_DAILY";

export function DailyPriceChart({ companyName, snapshot, compact = false }: Props) {
  if (!snapshot.latest || snapshot.points.length < 2) {
    return (
      <div className={compact ? "price-empty price-empty--compact" : "price-empty"}>
        <strong>일별 주가 준비 중</strong>
        {!compact && <p>연결된 공식 일별 시세가 아직 없습니다. 데이터가 수집되면 그래프가 표시됩니다.</p>}
      </div>
    );
  }

  const direction = (snapshot.changeAmount ?? 0) > 0 ? "up" : (snapshot.changeAmount ?? 0) < 0 ? "down" : "flat";
  const path = buildLinePath(snapshot.points.map((point) => point.closePrice), WIDTH, HEIGHT, PADDING);
  const firstDate = formatDate(snapshot.points[0]?.tradingDate);
  const latestDate = formatDate(snapshot.latest.tradingDate);

  return (
    <div className={compact ? "price-chart price-chart--compact" : "price-chart"}>
      <div className="price-chart__summary">
        <strong>{formatWon(snapshot.latest.closePrice)}</strong>
        <span className={`price-change price-change--${direction}`}>
          {formatChange(snapshot.changeAmount, snapshot.changeRate)}
        </span>
      </div>
      <svg
        className="price-chart__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${companyName} ${snapshot.period} 일별 종가 그래프. ${firstDate}부터 ${latestDate}까지, 최근 종가 ${formatWon(snapshot.latest.closePrice)}`}
      >
        <path className={`price-chart__line price-chart__line--${direction}`} d={path} vectorEffect="non-scaling-stroke" />
      </svg>
      {!compact && (
        <div className="price-chart__axis" aria-hidden="true">
          <span>{firstDate}</span>
          <span>{latestDate}</span>
        </div>
      )}
      {compact ? (
        <small className="price-chart__notice">최근 1개월 일별 종가 · KRX</small>
      ) : (
        <small className="price-chart__notice">일별 종가 · 실시간 시세 아님</small>
      )}
      {!compact && snapshot.sourceId === KRX_DAILY_SOURCE && (
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

function formatChange(amount: number | null, rate: number | null): string {
  if (amount === null || rate === null) return "전일 비교 준비 중";
  const prefix = amount > 0 ? "+" : "";
  const direction = amount > 0 ? "▲" : amount < 0 ? "▼" : "–";
  return `${direction} ${prefix}${new Intl.NumberFormat("ko-KR").format(amount)}원 (${prefix}${rate.toFixed(2)}%)`;
}

function formatDate(value: string | undefined): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year.slice(2)}.${month}.${day}` : value;
}

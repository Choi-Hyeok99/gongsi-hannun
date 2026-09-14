"use client";

import React, { useState } from "react";
import type { DailyPriceSnapshot } from "@/domain/daily-price";

type Props = Readonly<{ companyName: string; snapshot: DailyPriceSnapshot; compact?: boolean }>;

const WIDTH = 720;
const PRICE_HEIGHT = 220;
const VOLUME_TOP = 238;
const VOLUME_HEIGHT = 48;
const HEIGHT = 292;
const PADDING_LEFT = 12;
const PADDING_RIGHT = 72;
const KRX_DAILY_SOURCE = "KRX_DAILY";

export function DailyPriceChart({ companyName, snapshot, compact = false }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  if (!snapshot.latest || snapshot.points.length < 2) {
    return (
      <div className={compact ? "price-empty price-empty--compact" : "price-empty"}>
        <strong>일별 주가 준비 중</strong>
        {!compact && <p>연결된 공식 일별 시세가 아직 없습니다. 데이터가 수집되면 그래프가 표시됩니다.</p>}
      </div>
    );
  }

  const direction = (snapshot.changeAmount ?? 0) > 0 ? "up" : (snapshot.changeAmount ?? 0) < 0 ? "down" : "flat";
  const closes = snapshot.points.map((point) => point.closePrice);
  const path = buildLinePath(closes, WIDTH, PRICE_HEIGHT, PADDING_LEFT, compact ? PADDING_LEFT : PADDING_RIGHT);
  const firstDate = formatDate(snapshot.points[0]?.tradingDate);
  const latestDate = formatDate(snapshot.latest.tradingDate);

  if (compact) {
    return (
      <div className="price-chart price-chart--compact">
        <div className="price-chart__summary">
          <strong>{formatWon(snapshot.latest.closePrice)}</strong>
          <span className={`price-change price-change--${direction}`}>{formatChange(snapshot.changeAmount, snapshot.changeRate)}</span>
        </div>
        <svg className="price-chart__svg" viewBox={`0 0 ${WIDTH} ${PRICE_HEIGHT}`} preserveAspectRatio="none" role="img"
          aria-label={`${companyName} ${snapshot.period} 일별 종가 그래프. ${firstDate}부터 ${latestDate}까지, 최근 종가 ${formatWon(snapshot.latest.closePrice)}`}>
          <path className={`price-chart__line price-chart__line--${direction}`} d={path} vectorEffect="non-scaling-stroke" />
        </svg>
        <small className="price-chart__notice">최근 1개월 일별 종가 · KRX</small>
      </div>
    );
  }

  const minimum = Math.min(...closes);
  const maximum = Math.max(...closes);
  const range = maximum - minimum || 1;
  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const maximumVolume = Math.max(...snapshot.points.map((point) => point.volume), 1);
  const activeIndex = selectedIndex ?? snapshot.points.length - 1;
  const selected = snapshot.points[activeIndex] ?? snapshot.latest;
  const selectedX = pointX(activeIndex, snapshot.points.length, plotWidth);
  const selectedY = priceY(selected.closePrice, minimum, range);
  const periodHigh = Math.max(...snapshot.points.map((point) => point.highPrice ?? point.closePrice));
  const periodLow = Math.min(...snapshot.points.map((point) => point.lowPrice ?? point.closePrice));

  function selectFromPointer(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const chartX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const ratio = Math.max(0, Math.min(1, (chartX - PADDING_LEFT) / plotWidth));
    setSelectedIndex(Math.round(ratio * (snapshot.points.length - 1)));
  }

  return (
    <div className="price-chart price-chart--detailed">
      <div className="price-chart__summary">
        <strong>{formatWon(snapshot.latest.closePrice)}</strong>
        <span className={`price-change price-change--${direction}`}>{formatChange(snapshot.changeAmount, snapshot.changeRate)}</span>
        <span className="price-chart__as-of">{latestDate} 종가 기준</span>
      </div>
      <div className="price-chart__period-stats" aria-label={`${snapshot.period} 기간 통계`}>
        <span>기간 고가 <strong>{formatWon(periodHigh)}</strong></span>
        <span>기간 저가 <strong>{formatWon(periodLow)}</strong></span>
      </div>
      <svg
        className="price-chart__svg price-chart__svg--interactive"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        tabIndex={0}
        aria-label={`${companyName} ${snapshot.period} 일별 가격과 거래량 그래프. 좌우 방향키나 포인터로 날짜별 상세 값을 확인할 수 있습니다.`}
        onPointerMove={selectFromPointer}
        onPointerDown={selectFromPointer}
        onPointerLeave={() => setSelectedIndex(null)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const current = selectedIndex ?? snapshot.points.length - 1;
          setSelectedIndex(Math.max(0, Math.min(snapshot.points.length - 1, current + (event.key === "ArrowLeft" ? -1 : 1))));
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = 10 + ratio * (PRICE_HEIGHT - 20);
          const value = maximum - ratio * range;
          return (
            <g key={ratio}>
              <line className="price-chart__grid" x1={PADDING_LEFT} x2={WIDTH - PADDING_RIGHT} y1={y} y2={y} />
              <text className="price-chart__scale" x={WIDTH - PADDING_RIGHT + 8} y={y + 4}>{formatCompactWon(value)}</text>
            </g>
          );
        })}
        <path className={`price-chart__line price-chart__line--${direction}`} d={path} vectorEffect="non-scaling-stroke" />
        {snapshot.points.map((point, index) => {
          const x = pointX(index, snapshot.points.length, plotWidth);
          const barHeight = Math.max(1, (point.volume / maximumVolume) * VOLUME_HEIGHT);
          const barWidth = Math.max(1.5, plotWidth / snapshot.points.length / 1.6);
          return <rect className="price-chart__volume" key={point.tradingDate} x={x - barWidth / 2}
            y={VOLUME_TOP + VOLUME_HEIGHT - barHeight} width={barWidth} height={barHeight} />;
        })}
        <line className="price-chart__crosshair" x1={selectedX} x2={selectedX} y1={10} y2={VOLUME_TOP + VOLUME_HEIGHT} />
        <circle className={`price-chart__marker price-chart__marker--${direction}`} cx={selectedX} cy={selectedY} r={5} />
        <text className="price-chart__volume-label" x={PADDING_LEFT} y={VOLUME_TOP - 7}>거래량</text>
      </svg>
      <div className="price-chart__axis" aria-hidden="true"><span>{firstDate}</span><span>{latestDate}</span></div>
      <dl className="price-chart__details" aria-live="polite">
        <div><dt>선택일</dt><dd>{formatDate(selected.tradingDate)}</dd></div>
        <div><dt>시가</dt><dd>{formatWon(selected.openPrice ?? selected.closePrice)}</dd></div>
        <div><dt>고가</dt><dd>{formatWon(selected.highPrice ?? selected.closePrice)}</dd></div>
        <div><dt>저가</dt><dd>{formatWon(selected.lowPrice ?? selected.closePrice)}</dd></div>
        <div><dt>종가</dt><dd>{formatWon(selected.closePrice)}</dd></div>
        <div><dt>거래량</dt><dd>{formatNumber(selected.volume)}주</dd></div>
      </dl>
      <small className="price-chart__notice">그래프를 가리키거나 터치하면 날짜별 상세 값을 볼 수 있습니다 · 일별 종가 · 실시간 시세 아님</small>
      {snapshot.sourceId === KRX_DAILY_SOURCE && <small className="price-chart__source">출처: 한국거래소 통계정보</small>}
    </div>
  );
}

export function buildLinePath(values: readonly number[], width: number, height: number, paddingLeft: number, paddingRight = paddingLeft): string {
  if (values.length < 2) return "";
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  return values.map((value, index) => {
    const x = paddingLeft + (index / (values.length - 1)) * (width - paddingLeft - paddingRight);
    const y = 10 + ((maximum - value) / range) * (height - 20);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function pointX(index: number, count: number, plotWidth: number): number {
  return PADDING_LEFT + (index / Math.max(1, count - 1)) * plotWidth;
}

function priceY(value: number, minimum: number, range: number): number {
  return 10 + ((minimum + range - value) / range) * (PRICE_HEIGHT - 20);
}

function formatWon(value: number): string { return `${formatNumber(value)}원`; }
function formatNumber(value: number): string { return new Intl.NumberFormat("ko-KR").format(Math.round(value)); }
function formatCompactWon(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}백만`;
  if (Math.abs(value) >= 10_000) return `${Math.round(value / 10_000)}만`;
  return formatNumber(value);
}

function formatChange(amount: number | null, rate: number | null): string {
  if (amount === null || rate === null) return "전일 비교 준비 중";
  const prefix = amount > 0 ? "+" : "";
  const direction = amount > 0 ? "▲" : amount < 0 ? "▼" : "–";
  return `${direction} ${prefix}${formatNumber(amount)}원 (${prefix}${rate.toFixed(2)}%)`;
}

function formatDate(value: string | undefined): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year.slice(2)}.${month}.${day}` : value;
}

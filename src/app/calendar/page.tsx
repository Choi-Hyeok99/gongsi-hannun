import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { resolveSelectedCalendarDay } from "@/components/disclosure-calendar-selection";
import { createDisclosureRepository } from "@/data/supabase-disclosure-repository";
import { getDisclosureEventTypeLabel } from "@/domain/disclosure-classification";
import type { DisclosureSummary } from "@/domain/disclosure-query";
import { listDisclosureCalendar, resolveDisclosureCalendarMonth } from "@/server/disclosure-use-cases";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "중요 공시 달력 | 공시한눈", description: "날짜별 주요 공시를 달력으로 확인합니다." };

type Props = Readonly<{ searchParams: Promise<{ month?: string; day?: string }> }>;

export default async function CalendarPage({ searchParams }: Props) {
  const { month: rawMonth, day: rawDay } = await searchParams;
  const result = await Promise.resolve()
    .then(() => listDisclosureCalendar(createDisclosureRepository(), rawMonth ?? null))
    .then((value) => ({ ...value, failed: false as const }))
    .catch(() => ({ month: resolveDisclosureCalendarMonth(rawMonth ?? null), items: [], failed: true as const }));
  const days = groupByDay(result.items);
  const [year, monthNumber] = result.month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year!, monthNumber! - 1, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + lastDay) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => index < firstWeekday || index >= firstWeekday + lastDay ? null : index - firstWeekday + 1);
  const selectedDay = resolveSelectedCalendarDay(rawDay, lastDay, days.keys());
  const selectedItems = days.get(selectedDay) ?? [];

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>중요 공시 달력</span></div>
        <section className="calendar-heading">
          <div><p className="eyebrow">일정 모아보기</p><h1>중요 공시 달력</h1></div>
          <nav aria-label="달력 월 이동" className="calendar-navigation">
            <Link href={`/calendar?month=${shiftMonth(result.month, -1)}`}>← 이전 달</Link>
            <strong>{year}년 {monthNumber}월</strong>
            <Link href={`/calendar?month=${shiftMonth(result.month, 1)}`}>다음 달 →</Link>
          </nav>
        </section>
        <p className="calendar-notice">{result.failed ? "공시 일정을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요." : "중요도 70점 이상인 공시를 공식 발표일 기준으로 표시합니다. 공시를 누르면 상세 내용과 원문을 확인할 수 있습니다."}</p>
        <section className="calendar-grid" aria-label={`${year}년 ${monthNumber}월 주요 공시`}>
          {['일','월','화','수','목','금','토'].map((weekday) => <strong className="calendar-weekday" key={weekday}>{weekday}</strong>)}
          {cells.map((day, index) => <CalendarCell day={day} items={day ? days.get(day) ?? [] : []} key={`${day ?? 'blank'}-${index}`} />)}
        </section>
        <section className="calendar-mobile" aria-label={`${year}년 ${monthNumber}월 모바일 달력`}>
          <div className="calendar-mobile__weekdays" aria-hidden="true">
            {['일','월','화','수','목','금','토'].map((weekday) => <strong key={weekday}>{weekday}</strong>)}
          </div>
          <ol className="calendar-mobile__grid">
            {cells.map((day, index) => (
              <li aria-hidden={day ? undefined : true} key={`${day ?? 'blank'}-${index}`}>
                {day ? (
                  <Link
                    aria-current={day === selectedDay ? "date" : undefined}
                    aria-label={`${monthNumber}월 ${day}일, 주요 공시 ${days.get(day)?.length ?? 0}건`}
                    href={`/calendar?month=${result.month}&day=${String(day).padStart(2, "0")}`}
                  >
                    <span>{day}</span>
                    {(days.get(day)?.length ?? 0) > 0 ? <small aria-hidden="true">{days.get(day)!.length}</small> : null}
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
          <div className="calendar-mobile__selection">
            <h2>{monthNumber}월 {selectedDay}일 주요 공시</h2>
            {selectedItems.length ? selectedItems.map((item) => <CalendarItem item={item} key={item.receiptNumber} />) : (
              <div className="empty-state"><strong>선택한 날짜의 주요 공시가 없습니다.</strong><p>공시 건수가 표시된 다른 날짜를 선택해 보세요.</p></div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function CalendarCell({ day, items }: Readonly<{ day: number | null; items: readonly DisclosureSummary[] }>) {
  return <div className={day ? "calendar-day" : "calendar-day calendar-day--blank"}>{day && <><span>{day}</span>{items.slice(0, 3).map((item) => <CalendarItem item={item} key={item.receiptNumber} />)}{items.length > 3 && <small>+{items.length - 3}건</small>}</>}</div>;
}

function CalendarItem({ item }: Readonly<{ item: DisclosureSummary }>) {
  return <Link className="calendar-item" href={`/disclosures/${item.receiptNumber}`}><strong>{item.company.name}</strong><span>{getDisclosureEventTypeLabel(item.eventType)}</span></Link>;
}

function groupByDay(items: readonly DisclosureSummary[]): Map<number, DisclosureSummary[]> {
  const grouped = new Map<number, DisclosureSummary[]>();
  for (const item of items) {
    const day = Number(item.disclosedOn.slice(8, 10));
    grouped.set(day, [...(grouped.get(day) ?? []), item]);
  }
  return grouped;
}

function shiftMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, monthNumber! - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

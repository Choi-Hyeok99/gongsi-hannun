import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createDisclosureRepository } from "@/data/supabase-disclosure-repository";
import { getDisclosureEventTypeLabel } from "@/domain/disclosure-classification";
import type { DisclosureSummary } from "@/domain/disclosure-query";
import { listDisclosureCalendar } from "@/server/disclosure-use-cases";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "중요 공시 달력 | 공시한눈", description: "날짜별 주요 공시를 달력으로 확인합니다." };

type Props = Readonly<{ searchParams: Promise<{ month?: string }> }>;

export default async function CalendarPage({ searchParams }: Props) {
  const { month: rawMonth } = await searchParams;
  const result = await listDisclosureCalendar(createDisclosureRepository(), rawMonth ?? null);
  const days = groupByDay(result.items);
  const [year, monthNumber] = result.month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year!, monthNumber! - 1, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
  const cells = Array.from({ length: firstWeekday + lastDay }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);

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
        <p className="calendar-notice">중요도 70점 이상인 공시를 공식 발표일 기준으로 표시합니다. 공시를 누르면 상세 내용과 원문을 확인할 수 있습니다.</p>
        <section className="calendar-grid" aria-label={`${year}년 ${monthNumber}월 주요 공시`}>
          {['일','월','화','수','목','금','토'].map((weekday) => <strong className="calendar-weekday" key={weekday}>{weekday}</strong>)}
          {cells.map((day, index) => <CalendarCell day={day} items={day ? days.get(day) ?? [] : []} key={`${day ?? 'blank'}-${index}`} />)}
        </section>
        <section className="calendar-agenda" aria-label="주요 공시 날짜별 목록">
          {days.size ? [...days.entries()].map(([day, items]) => (
            <div className="calendar-agenda__day" key={day}>
              <h2>{monthNumber}월 {day}일</h2>
              {items.map((item) => <CalendarItem item={item} key={item.receiptNumber} />)}
            </div>
          )) : <div className="empty-state"><strong>이달의 주요 공시가 없습니다.</strong></div>}
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

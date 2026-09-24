import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { createNotificationCenterRepository } from "@/data/supabase-notification-center-repository";
import { getDisclosureEventTypeLabel } from "@/domain/disclosure-classification";
import { filterNotifications, parseNotificationView, type NotificationView } from "@/domain/notification-center";
import { listNotifications } from "@/server/notification-center-use-cases";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { markAllNotificationsRead, openNotification } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "중요 공시 알림 | 공시한눈" };

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

type Props = Readonly<{ searchParams: Promise<{ view?: string }> }>;

const FILTERS: readonly Readonly<{ value: NotificationView; label: string }>[] = [
  { value: "all", label: "전체" },
  { value: "unread", label: "읽지 않음" },
  { value: "critical", label: "85점 이상" },
];

export default async function NotificationsPage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/notifications")}&message=${encodeURIComponent("로그인 후 알림을 확인할 수 있습니다.")}`);

  const notifications = await listNotifications(createNotificationCenterRepository(), user.id);
  const view = parseNotificationView((await searchParams).view);
  const visibleNotifications = filterNotifications(notifications, view);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const criticalCount = notifications.filter((notification) => notification.importanceScore >= 85).length;
  const companyCount = new Set(notifications.map((notification) => notification.stockCode)).size;

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>중요 공시 알림</span></div>
        <section className="page-intro notification-intro">
          <div>
            <p className="eyebrow">나만의 공시 비서</p>
            <h1>중요 공시 알림</h1>
            <p>관심기업에서 새로 감지된 중요 공시를 우선순위대로 모았습니다.</p>
          </div>
          {unreadCount > 0 ? <form action={markAllNotificationsRead}><button className="secondary-button" type="submit">모두 읽음</button></form> : null}
        </section>
        <p className="alert-disclaimer">이 알림은 공시 확인을 돕는 자동 분류 정보이며 투자 권유가 아닙니다. 투자 판단 전 원문을 확인하세요.</p>
        <PushNotificationSettings />
        <section className="notification-overview" aria-label="알림 요약과 설정">
          <dl className="notification-stats">
            <div><dt>읽지 않음</dt><dd>{unreadCount}</dd></div>
            <div><dt>핵심 알림</dt><dd>{criticalCount}</dd></div>
            <div><dt>알림 기업</dt><dd>{companyCount}</dd></div>
          </dl>
          <div className="notification-preference-link">
            <div><strong>기업별 알림 기준</strong><p>기업마다 알림 여부·중요도·공시 유형을 조절할 수 있습니다.</p></div>
            <Link className="secondary-button" href="/watchlist#alert-preferences">기준 설정</Link>
          </div>
        </section>
        <section aria-labelledby="notification-heading">
          <div className="result-heading"><h2 id="notification-heading">알림 내역</h2><span>최근 {notifications.length}개</span></div>
          <nav className="notification-filters" aria-label="알림 내역 필터">
            {FILTERS.map((filter) => (
              <Link href={filter.value === "all" ? "/notifications" : `/notifications?view=${filter.value}`} aria-current={view === filter.value ? "page" : undefined} key={filter.value}>
                {filter.label}{filter.value === "unread" ? ` ${unreadCount}` : filter.value === "critical" ? ` ${criticalCount}` : ` ${notifications.length}`}
              </Link>
            ))}
          </nav>
          {visibleNotifications.length > 0 ? (
            <div className="notification-list">
              {visibleNotifications.map((notification) => (
                <form action={openNotification} key={notification.id}>
                  <input type="hidden" name="notificationId" value={notification.id} />
                  <button className={`notification-card${notification.readAt ? " notification-card--read" : ""}`} type="submit" aria-label={`${notification.companyName} ${notification.reportName} 공시 상세 열기`}>
                    <span className="notification-card__status" aria-label={notification.readAt ? "읽음" : "읽지 않음"}>{notification.readAt ? "읽음" : "새 알림"}</span>
                    <span className="notification-card__body">
                      <span className="notification-card__meta">
                        <strong>{notification.companyName}</strong>
                        <span>{getDisclosureEventTypeLabel(notification.eventType)}</span>
                        <span>중요도 {notification.importanceScore}점</span>
                      </span>
                      <strong className="notification-card__title">{notification.reportName}</strong>
                      <span className="notification-card__reason">{notification.reason}</span>
                      <span className="notification-card__time">공시 {notification.disclosedOn} · 알림 {formatDateTime(notification.createdAt)}</span>
                    </span>
                    <span className="card-arrow" aria-hidden="true">→</span>
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>{notifications.length ? "이 조건에 맞는 알림이 없습니다." : "아직 도착한 중요 공시 알림이 없습니다."}</strong>
              <p>{notifications.length ? "다른 필터를 선택하면 이전 알림을 확인할 수 있습니다." : "관심기업을 저장하면 중요 공시를 자동으로 골라 이곳에 알려드립니다."}</p>
              <Link className="primary-link" href={notifications.length ? "/notifications" : "/search"}>{notifications.length ? "전체 알림 보기" : "관심기업 찾기"}</Link>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

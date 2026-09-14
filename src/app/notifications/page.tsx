import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createNotificationCenterRepository } from "@/data/supabase-notification-center-repository";
import { getDisclosureEventTypeLabel } from "@/domain/disclosure-classification";
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

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/notifications")}&message=${encodeURIComponent("로그인 후 알림을 확인할 수 있습니다.")}`);

  const notifications = await listNotifications(createNotificationCenterRepository(), user.id);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

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
        <section aria-labelledby="notification-heading">
          <div className="result-heading"><h2 id="notification-heading">내 알림</h2><span>미읽음 {unreadCount}개 · 전체 {notifications.length}개</span></div>
          {notifications.length > 0 ? (
            <div className="notification-list">
              {notifications.map((notification) => (
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
              <strong>아직 도착한 중요 공시 알림이 없습니다.</strong>
              <p>관심기업을 저장하면 중요 공시를 자동으로 골라 이곳에 알려드립니다.</p>
              <Link className="primary-link" href="/search">관심기업 찾기</Link>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

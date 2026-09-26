import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { PrimaryNavigation } from "@/components/PrimaryNavigation";
import { createNotificationCenterRepository } from "@/data/supabase-notification-center-repository";
import { countUnreadNotifications } from "@/server/notification-center-use-cases";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function SiteHeader() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  let unreadCount = 0;
  if (user) {
    try {
      unreadCount = await countUnreadNotifications(createNotificationCenterRepository(), user.id);
    } catch {
      unreadCount = 0;
    }
  }

  return (
    <header className="site-header">
      <div className="content-container site-header__inner">
        <Link className="brand" href="/" aria-label="공시한눈 홈">
          <span className="brand-mark" aria-hidden="true">공</span>
          <span>공시한눈</span>
        </Link>
        <div className="site-header__nav-cluster">
          <PrimaryNavigation />
          {user ? (
            <nav className="account-navigation account-navigation--signed-in" aria-label="사용자 메뉴">
              <Link href="/watchlist">관심기업</Link>
              <Link className="notification-nav" href="/notifications" aria-label={`중요 공시 알림${unreadCount ? `, 읽지 않은 알림 ${unreadCount}개` : ""}`}>
                <span aria-hidden="true">🔔</span>
                {unreadCount > 0 ? <strong>{unreadCount > 99 ? "99+" : unreadCount}</strong> : null}
              </Link>
              <Link href="/account">내 정보</Link>
              <form action={logout} className="auth-nav">
                <span title={user.email}>{user.email}</span>
                <button type="submit">로그아웃</button>
              </form>
            </nav>
          ) : (
            <nav className="account-navigation" aria-label="사용자 메뉴"><Link href="/login">로그인</Link><Link className="nav-signup" href="/signup">회원가입</Link></nav>
          )}
        </div>
      </div>
    </header>
  );
}

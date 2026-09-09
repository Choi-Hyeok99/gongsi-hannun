import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function SiteHeader() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="site-header">
      <div className="content-container site-header__inner">
        <Link className="brand" href="/" aria-label="공시한눈 홈">
          <span className="brand-mark" aria-hidden="true">공</span>
          <span>공시한눈</span>
        </Link>
        <nav aria-label="주요 메뉴">
          <Link href="/search?query=삼성">기업</Link>
          <Link href="/disclosures">오늘의 주요 공시</Link>
          {user ? (
            <div className="auth-nav">
              <Link href="/watchlist">관심기업</Link>
              <form action={logout} className="auth-nav">
                <span title={user.email}>{user.email}</span>
                <button type="submit">로그아웃</button>
              </form>
            </div>
          ) : (
            <div className="auth-nav"><Link href="/login">로그인</Link><Link className="nav-signup" href="/signup">회원가입</Link></div>
          )}
        </nav>
      </div>
    </header>
  );
}

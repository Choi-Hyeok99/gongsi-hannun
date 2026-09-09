import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="content-container site-header__inner">
        <Link className="brand" href="/" aria-label="공시한눈 홈">
          <span className="brand-mark" aria-hidden="true">공</span>
          <span>공시한눈</span>
        </Link>
        <nav aria-label="주요 메뉴">
          <Link href="/search?query=삼성">기업</Link>
          <span className="nav-disabled" aria-disabled="true">오늘의 주요 공시</span>
        </nav>
      </div>
    </header>
  );
}

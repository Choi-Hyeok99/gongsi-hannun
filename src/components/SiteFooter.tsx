import Link from "next/link";
import React from "react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="content-container site-footer__inner">
        <strong>공시한눈</strong>
        <p>본 서비스의 정보는 투자 권유가 아니며, 중요한 판단은 반드시 공식 공시 원문을 확인해야 합니다.</p>
        <nav aria-label="도움말과 정책">
          <Link href="/guide/terms">쉬운 공시 용어</Link>
          <Link href="/calendar">중요 공시 달력</Link>
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보 처리방침</Link>
        </nav>
      </div>
    </footer>
  );
}

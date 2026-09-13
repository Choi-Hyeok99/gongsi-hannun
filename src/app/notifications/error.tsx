"use client";

import Link from "next/link";

export default function NotificationsError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main className="content-container page-content">
      <div className="empty-state empty-state--page">
        <strong>알림을 불러오지 못했습니다.</strong>
        <p>잠시 후 다시 시도해 주세요.</p>
        <button className="primary-link" type="button" onClick={reset}>다시 시도</button>
        <Link className="text-link" href="/">홈으로 이동</Link>
      </div>
    </main>
  );
}

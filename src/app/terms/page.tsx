import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "이용약관 | 공시한눈" };

export default function TermsPage() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content policy-page">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>이용약관</span></div>
        <header className="page-intro">
          <p className="eyebrow">서비스 정책</p>
          <h1>이용약관</h1>
          <p>공시한눈의 서비스 이용 기준을 안내합니다.</p>
        </header>
        <p className="policy-draft-notice" role="note">공개 전 검토 초안입니다. 운영자 정보와 시행일 등 미확정 항목은 정식 공개 전 확정 필요합니다. 현재 문구를 최종 약관으로 간주하지 마세요.</p>
        <div className="policy-content">
          <section><h2>서비스의 범위</h2><p>공시한눈은 공개된 기업·공시 정보의 검색, 공시 원문 연결, 저장된 관심기업과 알림 기능을 제공합니다. 일부 설명은 자동 분류 또는 AI 분석으로 생성되며, 생성되지 않거나 지연될 수 있습니다.</p></section>
          <section><h2>정보 이용 시 유의사항</h2><p>화면의 공시 분류·요약·중요도·주가 데이터는 투자 권유가 아닙니다. 수집 및 반영 시차가 있을 수 있으므로 중요한 판단 전에는 표시된 기준일과 공식 공시 원문을 확인해야 합니다.</p></section>
          <section><h2>계정과 이용자 책임</h2><p>관심기업과 알림 등 개인화 기능은 로그인 후 이용할 수 있습니다. 이용자는 자신의 계정 접근 정보를 안전하게 관리하고, 서비스 운영이나 타인의 이용을 방해하지 않아야 합니다.</p></section>
          <section><h2>서비스 변경과 중단</h2><p>데이터 제공처 장애, 점검 또는 서비스 변경으로 일부 기능이 일시적으로 이용되지 않을 수 있습니다. 중요한 변경의 사전 안내 방식과 기간은 정식 공개 전 확정 필요합니다.</p></section>
          <section><h2>탈퇴와 데이터</h2><p>회원은 내 정보 화면에서 탈퇴를 요청할 수 있습니다. 탈퇴 시 계정과 연결된 관심기업·알림 설정 등은 삭제되며 복구할 수 없습니다. 법령상 보존 의무가 있는 정보의 항목과 보유기간은 정식 공개 전 확정 필요합니다.</p></section>
          <section><h2>운영 정보와 시행일</h2><p>운영자명, 연락처, 주소, 분쟁 처리 절차, 약관 시행일: <strong>정식 공개 전 확정 필요</strong>.</p></section>
        </div>
        <p className="policy-related">개인정보 처리에 관한 내용은 <Link href="/privacy">개인정보 처리방침</Link>에서 확인할 수 있습니다.</p>
      </main>
      <SiteFooter />
    </div>
  );
}

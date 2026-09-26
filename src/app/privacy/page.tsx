import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "개인정보 처리방침 | 공시한눈" };

export default function PrivacyPage() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="content-container page-content policy-page">
        <div className="breadcrumb"><Link href="/">홈</Link><span>/</span><span>개인정보 처리방침</span></div>
        <header className="page-intro">
          <p className="eyebrow">개인정보 안내</p>
          <h1>개인정보 처리방침</h1>
          <p>계정 및 알림 기능에 사용되는 정보의 처리 항목을 안내합니다.</p>
        </header>
        <p className="policy-draft-notice" role="note">공개 전 검토 초안입니다. 처리 주체·보유기간·위탁 및 국외이전 등은 사실관계 확인 후 정식 공개 전 확정 필요합니다. 미확정 내용을 확정된 정책으로 간주하지 마세요.</p>
        <div className="policy-content">
          <section><h2>처리 목적·항목과 법적 근거</h2><p>회원계약 체결 및 서비스 제공을 위해 이메일 주소, 인증·연동 계정 식별정보를 처리합니다. 관심기업·알림을 사용하면 저장한 기업, 알림 설정 및 알림 내역을 처리하고, 브라우저 푸시를 켜면 구독 식별정보를 저장합니다. 서비스 제공에 필요한 정보와 별도 동의가 필요한 선택 정보는 구분해야 하며, 실제 제공자별 세부 항목과 법적 근거는 정식 공개 전 확인·확정 필요합니다.</p></section>
          <section><h2>보유기간과 파기</h2><p>계정 운영에 필요한 정보는 계정 이용 중 처리되며, 탈퇴 시 삭제 대상이 됩니다. 백업·로그·법령상 보존 의무에 따른 구체적 보유기간과 파기 절차는 정식 공개 전 확정 필요합니다.</p></section>
          <section><h2>제3자 제공·처리 위탁·국외이전</h2><p>인증, 데이터 저장, 알림 및 AI 기능에 외부 서비스가 사용될 수 있습니다. 제공·위탁 여부, 업체명, 이전 국가·항목·방법·보유기간은 실제 운영 구성을 확인하여 <strong>정식 공개 전 확정 필요</strong>합니다. 확인되지 않은 사항을 ‘제공 없음’ 또는 ‘국외이전 없음’으로 표시하지 않습니다.</p></section>
          <section><h2>이용자의 권리</h2><p>회원은 내 정보 화면에서 계정 정보와 관심기업·알림 설정을 확인하고 변경할 수 있으며 탈퇴를 요청할 수 있습니다. 그 밖의 열람·정정·삭제·처리정지 요청 방법과 담당 연락처는 정식 공개 전 확정 필요합니다.</p></section>
          <section><h2>쿠키와 브라우저 알림</h2><p>로그인 세션 유지를 위한 쿠키가 사용될 수 있습니다. 브라우저 푸시는 사용자가 알림 권한을 허용하고 구독한 경우에만 동작하며, 브라우저 설정과 서비스의 알림 설정에서 해제할 수 있습니다. 추가 자동 수집 항목과 거부 방법은 정식 공개 전 확인 필요합니다.</p></section>
          <section><h2>만 14세 미만 아동</h2><p>공시한눈의 회원 서비스는 만 14세 이상 이용자를 대상으로 합니다. 만 14세 미만 이용자의 개인정보를 수집하는 별도 절차는 제공하지 않습니다.</p></section>
          <section><h2>안전성 확보</h2><p>계정별 접근 제한과 서비스 제공자의 인증·접근 제어를 사용합니다. 실제 적용 중인 관리적·기술적 보호조치의 상세 범위는 정식 공개 전 확인 필요합니다.</p></section>
          <section><h2>처리 주체와 문의처</h2><p>개인정보처리자, 개인정보 보호책임자 또는 담당 부서, 문의 연락처, 시행일: <strong>정식 공개 전 확정 필요</strong>.</p></section>
        </div>
        <p className="policy-related">서비스 이용 기준은 <Link href="/terms">이용약관</Link>에서 확인할 수 있습니다.</p>
      </main>
      <SiteFooter />
    </div>
  );
}

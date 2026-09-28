import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { isLegalPolicyReady, readLegalPolicyConfig } from "@/config/legal-policy";

export const metadata: Metadata = { title: "개인정보 처리방침 | 공시한눈" };

export default function PrivacyPage() {
  const policy = readLegalPolicyConfig();
  const ready = isLegalPolicyReady(policy);
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
        {!ready && <p className="policy-draft-notice" role="note">공개 전 검토 초안입니다. 처리 주체·보유기간·위탁 및 국외이전 등은 사실관계 확인 후 정식 공개 전 확정 필요합니다. 미확정 내용을 확정된 정책으로 간주하지 마세요.</p>}
        <div className="policy-content">
          <section><h2>처리 목적·항목과 법적 근거</h2><p>회원계약 체결 및 서비스 제공을 위해 이메일 주소와 인증·연동 계정 식별정보를 처리합니다. 카카오 로그인 제공 항목은 {policy.kakaoDataFields ?? "정식 공개 전 확정 필요"}입니다. 관심기업·알림을 사용하면 저장한 기업, 알림 설정 및 알림 내역을 처리하고, 브라우저 푸시를 켜면 구독 식별정보를 저장합니다.</p></section>
          <section><h2>보유기간과 파기</h2><p>계정 운영에 필요한 정보는 계정 이용 중 처리되며 탈퇴 시 삭제 대상이 됩니다. 백업·로그의 보존 및 삭제 기준은 {policy.backupRetention ?? "정식 공개 전 확정 필요"}입니다.</p></section>
          <section><h2>처리 위탁·국외이전</h2><p>Supabase: {policy.supabaseProcessing ?? "정식 공개 전 확정 필요"}<br />Cloudflare: {policy.cloudflareProcessing ?? "정식 공개 전 확정 필요"}<br />Google Gemini: {policy.geminiProcessing ?? "정식 공개 전 확정 필요"}</p></section>
          <section><h2>이용자의 권리</h2><p>회원은 내 정보 화면에서 계정 정보와 관심기업·알림 설정을 확인하고 변경하거나 탈퇴할 수 있습니다. 열람·정정·삭제·처리정지 문의는 {policy.privacyEmail ?? "정식 공개 전 확정 필요"}로 접수할 수 있습니다.</p></section>
          <section><h2>쿠키와 브라우저 알림</h2><p>로그인 세션 유지를 위한 쿠키가 사용됩니다. 브라우저 푸시는 사용자가 알림 권한을 허용하고 구독한 경우에만 동작하며, 브라우저 설정과 서비스의 알림 설정에서 해제할 수 있습니다.</p></section>
          <section><h2>만 14세 미만 아동</h2><p>공시한눈의 회원 서비스는 만 14세 이상 이용자를 대상으로 합니다. 만 14세 미만 이용자의 개인정보를 수집하는 별도 절차는 제공하지 않습니다.</p></section>
          <section><h2>안전성 확보</h2><p>계정별 행 수준 접근 제한, 관리자 키의 서버 전용 보관, 전송 구간 암호화와 최소 권한 접근 제어를 적용합니다.</p></section>
          <section><h2>처리 주체와 문의처</h2><p>개인정보처리자: <strong>{policy.operatorName ?? "정식 공개 전 확정 필요"}</strong><br />개인정보 담당: {policy.privacyOfficer ?? "정식 공개 전 확정 필요"}<br />문의: {policy.privacyEmail ?? "정식 공개 전 확정 필요"}<br />시행일: {policy.effectiveDate ?? "정식 공개 전 확정 필요"}</p></section>
          <section><h2>데이터 출처</h2><p>공시·시장 데이터의 공개 이용 근거는 {policy.krxUsageBasis ?? "정식 공개 전 확정 필요"}입니다.</p></section>
        </div>
        <p className="policy-related">서비스 이용 기준은 <Link href="/terms">이용약관</Link>에서 확인할 수 있습니다.</p>
      </main>
      <SiteFooter />
    </div>
  );
}

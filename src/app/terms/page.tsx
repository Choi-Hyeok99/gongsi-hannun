import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { readLegalPolicyConfig } from "@/config/legal-policy";

export const metadata: Metadata = { title: "이용약관 | 공시한눈" };

export default function TermsPage() {
  const policy = readLegalPolicyConfig();
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
        <div className="policy-content">
          <p>AI 요약·해설은 만 18세 이상 이용자를 대상으로 하며, 첫 열람 전에 연령 확인을 받습니다. 무료 AI 분석에는 개인정보를 제외한 기업·재무 사실만 사용하므로 개인별 보유내역 등 일부 공시는 새 AI 요약이 제공되지 않을 수 있습니다. 공시 원문은 기존처럼 확인할 수 있습니다.</p>
          <section><h2>제1조 목적과 운영자</h2><p>이 약관은 {policy.operatorName}이 운영하는 공시한눈의 이용 조건과 운영자·이용자의 권리 및 의무를 정합니다. 서비스를 이용하는 사람은 회원 또는 비회원 이용자입니다.</p></section>
          <section><h2>제2조 제공하는 서비스</h2><p>공시한눈은 공개 기업·공시 정보 검색, 공시 원문 연결, 공시 달력, AI 요약·해설, 관심기업 및 알림 기능을 제공합니다. 현재 서비스는 무료입니다. 유료 기능을 도입하는 경우 가격과 이용 조건을 별도로 안내하고 이용자의 신청 없이 결제하지 않습니다.</p><p>주가·지수는 화면에 표시된 기준일의 수집 데이터이며 실시간 시세를 보장하지 않습니다. 공시 및 알림의 수집·반영에는 시차가 있을 수 있습니다.</p></section>
          <section><h2>제3조 회원가입과 계정 관리</h2><p>회원 서비스는 만 14세 이상 이용자가 이메일 인증 또는 카카오 로그인 후 약관에 동의하고 개인정보 처리방침을 확인하여 이용할 수 있습니다. 관심기업·알림 등 개인화 기능은 로그인 후 제공됩니다. 이용자는 자신의 계정 정보를 안전하게 관리하고 타인의 계정 또는 인증 정보를 사용해서는 안 됩니다. 도용이 의심되면 문의처로 알려주세요.</p></section>
          <section><h2>제4조 AI 요약 이용</h2><p>비회원은 요약이 준비된 공시 1건을 무료로 열람할 수 있습니다. 처음 선택한 요약은 다시 열람할 수 있고, 다른 공시의 AI 요약은 회원가입·로그인 후 무료로 이용할 수 있습니다. 체험 이용 여부는 해당 브라우저의 쿠키로 최대 180일 동안 확인합니다. 브라우저나 기기의 실제 신원을 추적하지 않으며, 쿠키 삭제 또는 다른 브라우저 사용 시 체험 기록이 유지되지 않을 수 있습니다.</p><p>원문 미수집, 외부 AI 제공자의 장애·사용 한도 또는 검증 실패로 요약이 제공되지 않을 수 있습니다. 생성되지 않은 요약은 무료 체험 횟수를 차감하지 않습니다.</p></section>
          <section><h2>제5조 정보의 한계와 이용자 판단</h2><p>AI 결과는 자동 생성한 정보이며 오류나 누락이 있을 수 있습니다. 공시 분류·중요도·해설은 개인별 투자자문, 특정 종목의 매수·매도 권유 또는 수익 보장이 아닙니다. 투자 판단 전 공식 원문과 데이터 기준일을 확인해야 합니다. 정보 이용에 따른 판단은 이용자가 하되, 운영자의 고의·중대한 과실 등 법률상 책임까지 배제하지는 않습니다.</p></section>
          <section><h2>제6조 금지행위와 이용 제한</h2><p>타인의 개인정보·계정 무단 사용, 접근 권한 우회, 악성코드 유포, 과도한 자동 요청으로 서비스 운영을 방해하는 행위, 데이터의 이용 조건을 위반한 무단 재배포를 금지합니다. 위반 시 필요한 범위에서 이용을 제한하고 사유와 이의 제기 방법을 안내합니다. 긴급한 보안 위험은 우선 차단한 뒤 안내할 수 있습니다. 원본 데이터와 외부 링크의 권리는 각 권리자에게 있습니다.</p></section>
          <section><h2>제7조 변경·중단과 약관 개정</h2><p>점검, 데이터 제공처 장애, 보안 문제로 서비스가 일시 중단될 수 있습니다. 예정된 중요 변경은 {policy.changeNoticeDays}일 전 서비스 화면으로 안내하며, 긴급한 사유는 사후 안내할 수 있습니다. 약관 변경은 시행일과 변경 사유를 함께 알리고, 이용자에게 불리한 중요한 변경은 30일 전에 안내합니다. 필요한 경우 다시 동의를 받으며 단순히 안내를 보지 않았다는 이유만으로 새로운 동의를 간주하지 않습니다.</p></section>
          <section><h2>제8조 탈퇴와 문의</h2><p>회원은 내 정보 화면에서 본인 확인 후 탈퇴할 수 있습니다. 탈퇴하면 계정과 연결된 관심기업·알림·푸시 구독·정책 확인 기록이 삭제되며 복구할 수 없습니다. 서비스 제공자의 보안 로그 등 별도 보존 정보의 범위는 개인정보 처리방침을 따릅니다. 카카오 계정 자체는 삭제되지 않으며 연결 해제는 카카오 계정 설정에서도 관리할 수 있습니다.</p><p>서비스 이용, 이용 제한에 대한 이의 및 분쟁 문의는 <a href={`mailto:${policy.supportEmail}`}>{policy.supportEmail}</a>로 접수합니다. 이 약관은 대한민국 법률에 따르며 분쟁의 관할은 관련 법령에 따릅니다.</p></section>
          <section><h2>시행일</h2><p>운영자: <strong>{policy.operatorName}</strong><br />문의: <a href={`mailto:${policy.supportEmail}`}>{policy.supportEmail}</a><br />이 약관은 {policy.effectiveDate}부터 시행합니다.</p></section>
        </div>
        <p className="policy-related">개인정보 처리에 관한 내용은 <Link href="/privacy">개인정보 처리방침</Link>에서 확인할 수 있습니다.</p>
      </main>
      <SiteFooter />
    </div>
  );
}

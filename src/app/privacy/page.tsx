import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { readLegalPolicyConfig } from "@/config/legal-policy";

export const metadata: Metadata = { title: "개인정보 처리방침 | 공시한눈" };

export default function PrivacyPage() {
  const policy = readLegalPolicyConfig();
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
        <div className="policy-content">
          <section><h2>1. 처리 주체와 목적</h2><p>{policy.operatorName}은 회원 인증, 관심기업 관리, 공시 알림 제공 및 서비스 보안을 위해 필요한 정보를 처리합니다. 회원계약 이행에 필요한 정보와 이용자가 직접 선택한 기능에 필요한 정보만 처리하며, 광고·마케팅을 위한 개인정보 판매나 제공은 하지 않습니다.</p></section>
          <section><h2>2. 처리하는 정보</h2><ul><li>이메일 가입: 이메일 주소, 암호화된 비밀번호 인증 정보, 계정 식별자, 가입·로그인 기록. 비밀번호 원문을 운영자가 열람하지 않습니다.</li><li>카카오 로그인: 카카오 계정 식별자, 제공에 동의한 이메일과 프로필 정보. 카카오가 동의 범위에 따라 제공한 정보를 인증 서비스에 저장하며, 서비스 내 계정 확인에는 이메일·계정 식별자를 사용합니다.</li><li>개인화 기능: 관심기업, 기업별 알림 조건, 알림 내역 및 읽음 여부, 약관 동의·개인정보 처리방침 확인 버전과 시각.</li><li>브라우저 푸시: 구독 주소(endpoint), 전송에 필요한 암호화 키, 브라우저 정보 및 전송 상태. 알림 권한을 허용하고 구독할 때 수집합니다.</li><li>접속·보안: IP 주소, 요청 URL, 브라우저 정보, 접속·오류·인증 기록이 호스팅·인증 제공자의 로그에 기록될 수 있습니다.</li><li>문의: 이메일 주소와 이용자가 문의 메일에 작성한 내용. 주민등록번호, 비밀번호, API 키 등 민감한 정보는 보내지 마세요.</li></ul></section>
          <section><h2>3. 보유기간과 파기</h2><p>회원 및 개인화 정보는 계정 이용 기간 동안 보유합니다. 탈퇴가 완료되면 인증 계정과 연결된 관심기업·알림·푸시 구독·정책 확인 기록을 서비스 데이터베이스에서 삭제합니다. 전자정보는 복구할 수 없도록 삭제하며 별도의 회원정보 수동 백업을 만들지 않습니다.</p><p>Supabase의 외부 API·인증·데이터베이스 로그는 현재 무료 플랜 기준 1일간 보관됩니다. 인증 감사 로그의 별도 데이터베이스 기록은 꺼져 있습니다. Cloudflare Workers 로그는 요금제에 따라 3일 또는 7일간 보관되며, 공급자의 네트워크 보안·운영 정보에는 해당 공급자의 보존 정책이 적용됩니다. 법령상 보존 의무나 진행 중인 분쟁이 있으면 해당 사유와 기간에 필요한 정보만 분리하여 보관합니다.</p><p>문의 메일은 처리 완료 후 30일 이내 삭제하는 것을 원칙으로 하며, 계속되는 분쟁·법적 의무가 있으면 그 사유가 종료될 때까지 필요한 범위에서 보관합니다. 브라우저 체험 쿠키는 최대 180일 후 만료되거나 이용자가 직접 삭제할 수 있습니다.</p></section>
          <section><h2>4. 위탁과 국외 처리</h2><p>서비스를 제공하기 위해 아래 업체를 이용합니다. 데이터베이스가 국내에 있다는 이유로 모든 운영·로그 처리가 국내에서만 이루어지는 것은 아닙니다.</p><ul><li><strong>Supabase Pte. Ltd.</strong>: 계정 인증과 데이터베이스 운영. 회원·관심기업·알림 데이터를 암호화 통신으로 수시 처리하며 데이터베이스는 대한민국 서울(ap-northeast-2)에 저장합니다. 운영·지원은 싱가포르 및 미국의 Supabase, Inc.에서 필요에 따라 수행될 수 있고, 플랫폼 사용·로그 정보는 유럽연합에서 처리될 수 있습니다. 계정 데이터는 탈퇴 시 삭제하며 로그의 기간은 위 3항을 따릅니다. 상세 처리 위치와 문의처는 <a href="https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq" target="_blank" rel="noopener noreferrer">Supabase 처리 위치 안내</a>와 <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">개인정보 정책</a>에서 확인할 수 있습니다.</li><li><strong>Cloudflare, Inc.</strong>: 웹사이트 호스팅·콘텐츠 전달·접속 보안. 접속할 때 요청 URL, IP 및 브라우저 정보가 암호화 통신으로 글로벌 네트워크에서 처리됩니다. 미국을 포함한 서비스 제공 지역에서 요청·운영 정보가 처리될 수 있으며 위치는 요청 경로에 따라 달라집니다. 보유기간·지원 연락처와 처리 지역은 <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare 개인정보 정책</a> 및 <a href="https://www.cloudflare.com/cloudflare-customer-subprocessors/" target="_blank" rel="noopener noreferrer">처리 업체·지역 목록</a>을 확인할 수 있습니다.</li></ul><p>국외 처리에 관한 문의·거부 및 처리정지는 개인정보 문의처로 요청할 수 있습니다. 회원 인증·호스팅에 필수적인 처리까지 거부하면 해당 회원 기능을 제공하기 어려울 수 있으며, 계정 탈퇴를 요청할 수 있습니다. 필요한 이전의 법적 근거와 고지·동의 절차는 개인정보 보호법에 따릅니다.</p></section>
          <section><h2>5. AI 분석과 외부 서비스</h2><p>Google Gemini 무료 API에는 상장기업명, 공시일, 기업 공시 분류와 허용 목록에 있는 매출·손익·계약금액 등 기업·재무 사실만 보냅니다. 전체 공시 본문, 제출인·임원·주주 이름, 개인별 보유내역, 주소·연락처는 보내지 않습니다. 회원 이메일, 로그인 정보, 관심기업 목록, 푸시 구독 정보도 AI 요청에 넣지 않습니다. 안전하게 추출할 수 있는 기업 사실이 없으면 외부 AI 호출을 하지 않습니다.</p><p>무료 Gemini API의 입력·출력은 Google의 제품·모델 개선에 사용되거나 검토자가 확인할 수 있으므로 개인정보와 비공개 자료를 전송하지 않습니다. AI 요청은 요약 생성 시 암호화 통신으로 Google 서비스 제공 지역에서 처리되며, 악용 감지용 데이터는 Google 안내에 따라 55일간 보관될 수 있습니다. 관련 조건과 문의 경로는 <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Gemini API 이용 조건</a> 및 <a href="https://ai.google.dev/gemini-api/docs/usage-policies" target="_blank" rel="noopener noreferrer">악용 모니터링 안내</a>를 따릅니다.</p><p>푸시를 구독하면 브라우저가 지정한 Apple·Google·Mozilla 등의 전송 서비스로 구독 주소와 알림 내용이 전달됩니다. 기기 운영체제·브라우저의 처리 정책이 함께 적용됩니다. 카카오 로그인은 카카오의 동의 화면에 표시되는 정보 제공 범위와 개인정보 정책에 따릅니다. 문의 이메일 수신에는 NAVER 메일을 사용합니다.</p></section>
          <section><h2>6. 이용자의 권리와 요청 방법</h2><p>내 정보에서 계정 정보와 연결된 로그인 방식을 확인하고 탈퇴할 수 있습니다. 관심기업·알림 화면에서는 개인화 설정을 변경하고, 브라우저 설정에서는 푸시 권한을 해제할 수 있습니다. 이메일·연동 정보의 정정 또는 개인정보 열람·삭제·처리정지 요청은 <a href={`mailto:${policy.privacyEmail}`}>{policy.privacyEmail}</a>로 보내주세요. 필요한 범위에서 본인을 확인한 뒤 관련 법령의 기한 안에 처리하고, 제한 사유가 있으면 그 이유를 안내합니다. 대리인은 위임 관계를 확인할 수 있는 자료를 통해 요청할 수 있습니다.</p></section>
          <section><h2>7. 쿠키와 자동 수집</h2><p>로그인 유지용 쿠키, 비회원 AI 체험 확인용 <code>gongsi-ai-preview</code> 쿠키, 만 18세 이상 확인용 <code>gongsi-ai-adult</code> 쿠키를 사용합니다. 체험 쿠키에는 선택한 공시 번호·만료시각·위변조 방지 서명을, 연령 확인 쿠키에는 확인 여부·만료시각·서명만 저장합니다. 생년월일, 기기 고유 식별자나 기기 지문을 수집하지 않습니다. 체험·연령 쿠키의 최대 보유기간은 180일입니다. 브라우저 설정에서 차단·삭제할 수 있으나 로그인 유지 또는 AI 이용 기록 확인에 영향을 줄 수 있습니다. 광고 추적 쿠키나 별도의 광고 분석 도구는 현재 사용하지 않습니다.</p></section>
          <section><h2>만 14세 미만 아동</h2><p>공시한눈의 회원 서비스는 만 14세 이상 이용자를 대상으로 합니다. 만 14세 미만 이용자의 개인정보를 수집하는 별도 절차는 제공하지 않습니다.</p></section>
          <section><h2>9. 안전성 확보와 제공 제한</h2><p>전송 구간 암호화, 계정별 행 수준 접근 제한, 관리자 키의 서버 전용 보관, 최소 권한 접근 제어를 적용합니다. 개인정보를 제3자에게 판매하지 않으며 법률에 따른 적법한 요청 등 법적 근거가 있는 경우 외에는 별도로 제공하지 않습니다. 보안 사고가 발생하면 관련 법령에 따라 필요한 통지·신고 및 피해 방지 조치를 진행합니다.</p></section>
          <section><h2>10. 책임자·문의처와 변경 안내</h2><p>개인정보처리자 및 개인정보 보호책임자: <strong>{policy.privacyOfficer}</strong><br />문의: <a href={`mailto:${policy.privacyEmail}`}>{policy.privacyEmail}</a><br />시행일: {policy.effectiveDate}</p><p>개인정보 처리방침 변경 시 시행일과 변경 내용을 서비스에 안내합니다. 중요한 변경은 원칙적으로 7일 전, 이용자 권리에 중대한 영향을 주는 변경은 30일 전에 안내하며 법률상 동의가 필요한 경우 별도로 받습니다. 개인정보 침해 상담은 <a href="https://privacy.kisa.or.kr/" target="_blank" rel="noopener noreferrer">개인정보침해 신고센터</a>, 분쟁 조정은 <a href="https://www.kopico.go.kr/" target="_blank" rel="noopener noreferrer">개인정보분쟁조정위원회</a>를 이용할 수 있습니다.</p></section>
        </div>
        <p className="policy-related">서비스 이용 기준은 <Link href="/terms">이용약관</Link>에서 확인할 수 있습니다.</p>
      </main>
      <SiteFooter />
    </div>
  );
}

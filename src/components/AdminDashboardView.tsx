import Link from "next/link";
import React from "react";
import type { AdminDashboard } from "@/server/admin-dashboard";

const n = (value:number|null) => value === null ? "조회 불가" : value.toLocaleString("ko-KR");
const t = (value:string|null) => value ? new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",dateStyle:"short",timeStyle:"short"}).format(new Date(value)) : "기록 없음";
const connection = {CONNECTED:"연결됨",NOT_CONFIGURED:"통계 연결 필요",UNAVAILABLE:"조회 실패 · 권한 또는 제공사 상태 확인"};
const errorLabels: Record<string,string> = {AI_TIMEOUT:"응답 시간 초과",AI_PROVIDER_UNAVAILABLE:"제공사 일시 과부하",AI_RATE_LIMITED:"무료 한도 대기",AI_AUTH_ERROR:"API 인증 확인 필요",AI_REGION_UNAVAILABLE:"요청 지역 확인 필요",AI_INVALID_RESPONSE:"요약 형식 검증 실패",AI_BILLING_REQUIRED:"결제 설정 확인 필요"};
function Metric({label,value,note}:{label:string;value:number|null;note:string}) {
  return <section className="info-card admin-metric"><h2>{label}</h2><strong>{n(value)}</strong><p>{note}</p></section>;
}
export function AdminDashboardView({data}:{data:AdminDashboard}) {
  const lastTraffic = data.cloudflare.traffic.days.at(-1);
  return <div className="admin-dashboard">
    <header className="page-intro admin-intro"><div><p className="eyebrow">운영자 전용 · 읽기 전용</p><h1>운영 대시보드</h1><p>회원·이용량·AI 상태를 확인합니다. 갱신: {t(data.updatedAt)} (한국 시간)</p></div><Link href="/admin" className="secondary-button" prefetch={false}>새로고침</Link></header>
    <div className="admin-metrics-grid">
      <Metric label="가입 회원" value={data.counts.members} note="현재 남아 있는 회원 프로필 수 · 방문자 수와 다릅니다." />
      <Metric label="관심기업 등록" value={data.counts.watchlist} note="전체 회원의 등록 합계 · 같은 기업을 여러 회원이 등록하면 각각 집계합니다." />
      <Metric label="활성 푸시 구독" value={data.counts.push} note="수신 가능한 브라우저 구독 수 · 고유 이용자 수는 아닙니다." />
      <Metric label="오늘 저장된 AI 요약" value={data.counts.todaySummaries} note="한국 시간 00시 이후 저장 완료한 분석 기록 수" />
    </div>
    <section className="info-card admin-section"><h2>방문과 서버 요청</h2><p>Cloudflare 통계: {connection[data.cloudflare.traffic.status]} · 서버 통계: {connection[data.cloudflare.worker.status]}</p>
      <div className="admin-metrics-grid">
        <Metric label="최근 집계일 고유 접속 IP" value={lastTraffic?.uniqueIps ?? null} note={lastTraffic ? `${lastTraffic.date} (UTC) · 사람 수가 아닙니다. 봇·공유 IP의 영향이 있습니다.` : "Cloudflare 도메인 통계를 연결하면 표시됩니다. 누락을 0으로 표시하지 않습니다."} />
        <Metric label="최근 집계일 페이지 조회" value={lastTraffic?.pageViews ?? null} note="도메인 단위 Cloudflare 집계 · 오늘 집계는 진행 중일 수 있습니다." />
        <Metric label="최근 24시간 Worker 요청" value={data.cloudflare.worker.requests} note="페이지·API·봇·운영자 요청 포함 · 한 공시 조회가 여러 요청을 만들 수 있습니다." />
        <Metric label="최근 24시간 Worker 오류" value={data.cloudflare.worker.errors} note="Worker 실행 오류 · AI 503 응답 건수와 같지 않습니다." />
      </div>
      {data.cloudflare.traffic.days.length ? <div className="admin-table-wrap"><table><caption>최근 7일 도메인 트래픽 (UTC 기준 · 표본 집계 가능)</caption><thead><tr><th scope="col">날짜</th><th scope="col">고유 접속 IP</th><th scope="col">페이지 조회</th><th scope="col">전체 요청</th></tr></thead><tbody>{data.cloudflare.traffic.days.map(day=><tr key={day.date}><th scope="row">{day.date}</th><td>{n(day.uniqueIps)}</td><td>{n(day.pageViews)}</td><td>{n(day.requests)}</td></tr>)}</tbody></table></div> : null}
      <p className="admin-help">별도 추적 쿠키·기기 지문은 추가하지 않습니다. 날짜별 고유 IP를 더해 기간 전체의 고유 방문자 수로 계산하지 않습니다.</p>
    </section>
    <section className="info-card admin-section"><h2>AI 생성과 무료 한도</h2><p>방문 시 생성 모델: <strong>{data.model}</strong> · 저장된 요약을 다시 읽는 것은 새 생성 호출이 아닙니다.</p>
      <div className="admin-metrics-grid">
        <Metric label="오늘 생성 슬롯 사용" value={data.quota.calls} note={`사이트 안전 상한 ${data.quota.limit}회/일 · 미국 태평양 날짜 기준 · 제공사의 보장 한도가 아닙니다.`} />
        <Metric label="최근 7일 실제 생성 호출" value={data.usage.attempts} note="계측 도입 이후 실제 생성 요청만 기록 · 실패 포함 · 이전 호출은 소급 집계하지 않습니다." />
        <Metric label="누적 성공 분석 기록" value={data.counts.summaries} note="모든 분석 버전의 저장 기록 합계 · 공시 고유 수가 아닙니다." />
        <Metric label="현재 실패 분석 기록" value={data.counts.failedAnalyses} note="재시도 성공 시 줄어들 수 있습니다. 누적 실패 호출 수와 다릅니다." />
      </div>
      <p>공통 호출 차단: {!data.quota.available ? "조회 불가" : data.quota.blockedUntil && new Date(data.quota.blockedUntil)>new Date(data.updatedAt) ? `${t(data.quota.blockedUntil)}까지 대기` : "현재 차단 기록 없음"}</p>
      <div className="admin-table-wrap"><table><caption>최근 7일 생성 계측 (한국 날짜 · 도입 전 날짜에는 계측 기록이 없습니다.)</caption><thead><tr><th scope="col">날짜</th><th scope="col">생성 호출</th><th scope="col">출력 검증 통과</th></tr></thead><tbody>{data.usage.days.map(day=><tr key={day.date}><th scope="row">{day.date}</th><td>{n(day.attempts)}</td><td>{n(day.successes)}</td></tr>)}</tbody></table></div>
      {data.usage.truncated ? <p role="status">조회 범위를 넘었습니다. 토큰 합계·일별 수치는 불완전한 숫자 대신 조회 불가로 표시합니다.</p> : null}
      <p className="admin-help">‘출력 검증 통과’는 AI 응답 기준입니다. 저장 완료는 위의 저장 분석 기록 기준입니다. 집계에는 사용자 이메일·질문·공시 본문을 저장하지 않습니다.</p>
    </section>
    <section className="info-card admin-section"><h2>비용 확인</h2><p>실제 청구액은 아직 결제 API에 연결되지 않았습니다. 확정 금액이나 전체 비용을 임의로 0원이라고 표시하지 않습니다.</p>
      <dl className="company-facts">
        <div><dt>최근 7일 계측 입력 토큰</dt><dd>{n(data.usage.inputTokens)}</dd></div>
        <div><dt>최근 7일 계측 출력 토큰</dt><dd>{n(data.usage.outputTokens)}</dd></div>
        <div><dt>토큰 정보 미수신 호출</dt><dd>{n(data.usage.unmeasuredCalls)} · 실패·시간 초과 등은 토큰 정보가 없을 수 있습니다.</dd></div>
        <div><dt>계측 토큰의 유료 단가 환산</dt><dd>{data.usage.paidEquivalentUsd === null ? "조회 불가" : `$${data.usage.paidEquivalentUsd.toFixed(6)}`} · 실제 청구액 아님 · 미수신 토큰 제외</dd></div>
        <div><dt>Gemini 실제 청구액</dt><dd>미연결 · 무료 프로젝트라면 무료 범위 내 모델 호출료는 $0, 결제 등급은 제공사에서 확인</dd></div>
        <div><dt>Cloudflare·Supabase 청구액</dt><dd>미연결 · 플랜 기본료·다른 리소스·세금·도메인 비용 포함 여부를 결제 내역에서 확인</dd></div>
      </dl>
      <div className="account-actions"><a href="https://aistudio.google.com/usage" target="_blank" rel="noopener noreferrer">Gemini 사용량·결제 ↗</a><a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">Cloudflare 통계·청구 ↗</a><a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">Supabase 사용량·청구 ↗</a></div>
      <p className="admin-help">비교 단가 확인 기준: 2026-10-14 · <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noopener noreferrer">Google 공식 가격</a>. 모델별 단가로 계산하며 자동 유료 전환은 하지 않습니다.</p>
    </section>
    <div className="admin-bottom-grid">
      <section className="info-card admin-section"><h2>최근 분석 실패 상태</h2>{data.recentErrors === null ? <p>조회 실패</p> : data.recentErrors.length ? <ul className="admin-status-list">{data.recentErrors.map((error,index)=><li key={index}><span>{errorLabels[error.code] ?? "분석 처리 확인 필요"}<small>{error.code}</small></span><time>{t(error.at)}</time></li>)}</ul> : <p>실패 상태 기록이 없습니다.</p>}</section>
      <section className="info-card admin-section"><h2>최근 데이터 수집</h2>{data.collectors === null ? <p>조회 실패</p> : data.collectors.length ? <ul className="admin-status-list">{data.collectors.map((job,index)=><li key={index}><span>{job.job_type}<small>{job.status} · 실패 항목 {n(job.failed_count)}</small></span><time>{t(job.finished_at)}</time></li>)}</ul> : <p>수집 기록이 없습니다.</p>}<p>공개 공시 이벤트: {n(data.counts.publicEvents)}개</p></section>
    </div>
  </div>;
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnDemandAiResult } from "@/server/on-demand-ai-use-cases";

const MESSAGES = {
  GENERATING:"AI 요약을 생성하고 있습니다. 공시 원문은 지금 바로 읽을 수 있으며, 완료되면 요약이 자동으로 표시됩니다.",
  WAITING:"지금 다른 공시를 분석하고 있습니다. 이 화면을 열어두면 자동으로 다시 요청하며, 공시 원문은 바로 읽을 수 있습니다.",
  RATE_LIMIT:"무료 AI 생성 한도 또는 사이트 안전 상한에 도달했습니다. 저장된 요약은 이용할 수 있으며, 신규 생성은 한도 초기화 이후 다시 요청해 주세요. 유료로 자동 전환하지 않습니다.",
  SOURCE_UNAVAILABLE:"이 공시는 현재 AI 요약을 제공하지 않습니다. 개인정보 없이 자동 확인할 수 있는 기업 근거가 부족하거나 원문이 아직 준비되지 않았습니다. 아래 제출 문서와 원문을 확인해 주세요.",
  DELAYED:"AI 요약 생성이 지연되고 있습니다. 체험 횟수는 사용되지 않았으며, 공시 원문은 정상적으로 확인할 수 있습니다.",
  UNAVAILABLE:"방문 시 요약 생성 기능을 일시적으로 이용할 수 없습니다. 체험 횟수는 사용되지 않습니다. 잠시 후 다시 시도해 주세요.",
} as const;

export function OnDemandAiSummary({receiptNumber,originalUrl}:Readonly<{receiptNumber:string;originalUrl:string}>) {
  const router = useRouter();
  const [status,setStatus] = useState<keyof typeof MESSAGES>("GENERATING");
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now()+120_000;
    async function requestSummary() {
      try {
        const response = await fetch(`/api/disclosures/${receiptNumber}/ai-summary`,{method:"POST",credentials:"same-origin",cache:"no-store"});
        if (!active) return;
        if (response.status === 403) {router.refresh();return;}
        const result = await response.json() as OnDemandAiResult;
        if (!active) return;
        if (result.status === "READY") {router.refresh();return;}
        setStatus(result.status in MESSAGES ? result.status as keyof typeof MESSAGES : "UNAVAILABLE");
        if (result.status === "WAITING" && Date.now() < deadline) {
          timer=setTimeout(requestSummary,Math.max(5,Math.min(result.retryAfterSeconds ?? 10,30))*1_000);
        } else if (result.status === "WAITING") setStatus("DELAYED");
      } catch {if (active) setStatus("UNAVAILABLE");}
    }
    void requestSummary();
    // Do not abort a server generation on navigation. Its stored result can be reused.
    return () => {active=false;if(timer)clearTimeout(timer);};
  },[receiptNumber,router]);
  return <section className="ai-summary-preview" aria-labelledby="ai-summary-heading">
    <div className="ai-summary-preview__heading"><div><p className="eyebrow">원문 기반 분석</p><h2 id="ai-summary-heading">AI 공시 해설</h2></div><span className="ai-summary-preview__badge">{status === "GENERATING" ? "요약 생성 중" : status === "WAITING" ? "요청 대기" : status === "RATE_LIMIT" ? "무료 한도 대기" : "요약 안내"}</span></div>
    <div className="empty-state" role="status" aria-live="polite"><p>{MESSAGES[status]}</p><a className="primary-link" href={originalUrl} target="_blank" rel="noopener noreferrer">OpenDART 원문 보기</a></div>
    <p className="ai-summary-preview__notice">한 번 생성한 요약은 저장해 재사용합니다. AI 요약은 오류가 있을 수 있으며 투자 권유가 아닙니다.</p>
  </section>;
}

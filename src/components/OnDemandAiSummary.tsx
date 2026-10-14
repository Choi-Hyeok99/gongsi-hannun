"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnDemandAiResult } from "@/server/on-demand-ai-use-cases";
import {AI_SUMMARY_STATUS_COPY} from "@/domain/ai-summary-status-copy";

const MESSAGES = AI_SUMMARY_STATUS_COPY;

export function OnDemandAiSummary({receiptNumber,originalUrl}:Readonly<{receiptNumber:string;originalUrl:string}>) {
  const router = useRouter();
  const [status,setStatus] = useState<keyof typeof MESSAGES>("GENERATING");
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now()+120_000;
    async function requestSummary() {
      if (!active) return;
      if (Date.now() > deadline) {setStatus("DELAYED");return;}
      try {
        const response = await fetch(`/api/disclosures/${receiptNumber}/ai-summary`,{method:"POST",credentials:"same-origin",cache:"no-store"});
        if (!active) return;
        if (response.status === 403) {router.refresh();return;}
        const result = await response.json() as OnDemandAiResult;
        if (!active) return;
        if (result.status === "READY") {router.refresh();return;}
        setStatus(result.status in MESSAGES ? result.status as keyof typeof MESSAGES : "UNAVAILABLE");
        if ((result.status === "WAITING" || result.status === "RETRYING") && Date.now() < deadline) {
          timer=setTimeout(requestSummary,Math.max(5,Math.min(result.retryAfterSeconds ?? 10,60))*1_000);
        } else if (result.status === "WAITING" || result.status === "RETRYING") setStatus("DELAYED");
      } catch {if (active) setStatus("UNAVAILABLE");}
    }
    void requestSummary();
    // Do not abort a server generation on navigation. Its stored result can be reused.
    return () => {active=false;if(timer)clearTimeout(timer);};
  },[receiptNumber,router]);
  const busy = status === "GENERATING" || status === "WAITING" || status === "RETRYING";
  const content = MESSAGES[status];
  return <section className="ai-summary-preview" aria-labelledby="ai-summary-heading">
    <div className="ai-summary-preview__heading"><div><p className="eyebrow">원문 기반 분석</p><h2 id="ai-summary-heading">AI 공시 해설</h2></div><span className="ai-summary-preview__badge">{content.badge}</span></div>
    <div className="ai-summary-state" role="status" aria-live="polite" aria-busy={busy}>
      {busy ? <progress aria-label="AI 요약 처리 중" /> : <span className="ai-summary-state__icon" aria-hidden="true">i</span>}
      <strong>{content.title}</strong><p>{content.description}</p>
      <div className="ai-summary-state__actions"><a className="primary-link" href={originalUrl} target="_blank" rel="noopener noreferrer">공시 원문 바로 읽기</a>
      {!busy && status !== "RATE_LIMIT" && status !== "SOURCE_UNAVAILABLE" ? <a className="secondary-button" href={`/disclosures/${receiptNumber}`}>요약 다시 확인</a> : null}</div>
    </div>
    <p className="ai-summary-preview__notice">한 번 생성한 요약은 저장해 재사용합니다. AI 요약은 오류가 있을 수 있으며 투자 권유가 아닙니다.</p>
  </section>;
}

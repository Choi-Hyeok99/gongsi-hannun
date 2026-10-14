import Link from "next/link";
import React from "react";
import { openGuestAiSummary } from "@/app/disclosures/[receipt-number]/actions";

export function GuestAiSummaryGate({ receiptNumber, alreadyUsed, ageRequired = false, member = false, waiting = false }: Readonly<{receiptNumber:string;alreadyUsed:boolean;ageRequired?:boolean;member?:boolean;waiting?:boolean}>) {
  const next = encodeURIComponent(`/disclosures/${receiptNumber}`);
  return (
    <section className="ai-summary-preview" aria-labelledby="ai-summary-heading">
      <div className="ai-summary-preview__heading"><div><p className="eyebrow">원문 기반 분석</p><h2 id="ai-summary-heading">AI 공시 해설</h2></div></div>
      <div className="empty-state" role="status">
        <strong>{waiting ? "먼저 요청한 공시의 요약을 준비하고 있습니다" : member ? "AI 요약을 무료로 확인하세요" : alreadyUsed ? "다른 AI 요약도 무료로 확인하세요" : "로그인 없이 AI 요약 1건을 무료로 확인하세요"}</strong>
        <p>{waiting ? "이전에 요청한 공시 화면에서 결과를 확인해 주세요. 실패한 요청은 체험 횟수에 포함되지 않으며, 요청 예약은 최대 5분 뒤 해제됩니다." : member ? "첫 이용 때 한 번만 연령을 확인합니다. 같은 브라우저에서는 최대 180일 동안 다시 묻지 않습니다. 쿠키를 삭제하면 다시 확인할 수 있습니다." : alreadyUsed ? "첫 요약 체험을 이용했습니다. 회원가입하거나 로그인하면 다른 공시의 AI 요약도 무료로 볼 수 있습니다." : "선택한 공시의 요약이 없으면 생성한 뒤 보여드립니다. 같은 요약은 다시 볼 수 있으며, 다른 요약은 로그인 후 무료로 이용할 수 있습니다."}</p>
        {!alreadyUsed && <form action={openGuestAiSummary}>
          <input type="hidden" name="receiptNumber" value={receiptNumber} />
          {ageRequired && <p id="ai-age-notice">AI 요약은 만 18세 이상 이용자에게 제공됩니다. 요약에는 오류가 있을 수 있으니 중요한 내용은 공시 원문을 확인해 주세요.</p>}
          <button className="primary-link" type="submit" name={ageRequired ? "aiAdultConfirmed" : undefined} value={ageRequired ? "on" : undefined} aria-describedby={ageRequired ? "ai-age-notice" : undefined}>
            {ageRequired ? "만 18세 이상입니다 · 요약 보기" : waiting ? "먼저 요청한 공시로 이동" : member ? "AI 요약 보기" : "AI 요약 1건 무료로 보기"}
          </button>
        </form>}
        {!member && <div className="disclosure-detail__actions"><Link className={alreadyUsed ? "primary-link" : undefined} href={`/signup?next=${next}`}>무료 회원가입</Link><Link href={`/login?next=${next}`}>로그인</Link></div>}
      </div>
    </section>
  );
}

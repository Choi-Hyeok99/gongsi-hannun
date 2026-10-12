import Link from "next/link";
import React from "react";
import { openGuestAiSummary } from "@/app/disclosures/[receipt-number]/actions";

export function GuestAiSummaryGate({ receiptNumber, alreadyUsed, ageRequired = false, member = false }: Readonly<{receiptNumber:string;alreadyUsed:boolean;ageRequired?:boolean;member?:boolean}>) {
  const next = encodeURIComponent(`/disclosures/${receiptNumber}`);
  return (
    <section className="ai-summary-preview" aria-labelledby="ai-summary-heading">
      <div className="ai-summary-preview__heading"><div><p className="eyebrow">원문 기반 분석</p><h2 id="ai-summary-heading">AI 공시 해설</h2></div></div>
      <div className="empty-state" role="status">
        <strong>{member ? "AI 요약 이용 전 연령을 확인해 주세요" : alreadyUsed ? "다른 AI 요약도 무료로 확인하세요" : "로그인 없이 AI 요약 1건을 무료로 확인하세요"}</strong>
        <p>{member ? "AI 요약은 만 18세 이상 이용자에게 제공됩니다. 아래 항목을 확인하면 준비된 요약을 무료로 볼 수 있습니다." : alreadyUsed ? "첫 요약 체험을 이용했습니다. 회원가입하거나 로그인하면 다른 공시의 AI 요약도 무료로 볼 수 있습니다." : "요약이 준비된 공시 1건을 먼저 읽어볼 수 있습니다. 같은 요약은 다시 볼 수 있으며, 다른 요약은 로그인 후 무료로 이용할 수 있습니다."}</p>
        {!alreadyUsed && <form action={openGuestAiSummary}><input type="hidden" name="receiptNumber" value={receiptNumber} />{ageRequired && <label className="policy-consents"><input name="aiAdultConfirmed" type="checkbox" value="on" required /> 만 18세 이상이며 AI 요약의 오류 가능성과 원문 확인 필요성을 이해했습니다.</label>}<button className="primary-link" type="submit">{member ? "확인하고 AI 요약 보기" : "AI 요약 1건 무료로 보기"}</button></form>}
        {!member && <div className="disclosure-detail__actions"><Link className={alreadyUsed ? "primary-link" : undefined} href={`/signup?next=${next}`}>무료 회원가입</Link><Link href={`/login?next=${next}`}>로그인</Link></div>}
      </div>
    </section>
  );
}

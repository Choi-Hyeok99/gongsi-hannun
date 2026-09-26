import Link from "next/link";
import React from "react";
import type { AiDisclosureSummary, AiDisclosureSummaryState } from "@/domain/ai-disclosure-summary";
import type { DisclosureFactKind, VerifiedDisclosureFact } from "@/domain/ai-disclosure-facts";
import type { DisclosureDocumentCollectionStatus } from "@/domain/disclosure-document";

type Props = Readonly<{
  companyName: string;
  reportName: string;
  disclosedOn: string;
  eventTypeLabel: string;
  originalUrl: string;
  receiptNumber: string;
  state: AiDisclosureSummaryState;
  documentStatus?: DisclosureDocumentCollectionStatus;
}>;

export function AiDisclosureSummaryPreview(props: Props) {
  if (props.state.status !== "READY") return <AiSummaryStatus {...props} />;

  return props.state.summary.importanceScore >= 70
    ? <AiDeepReport {...props} summary={props.state.summary} />
    : <AiQuickSummary {...props} summary={props.state.summary} />;
}

function AiQuickSummary(props: Props & Readonly<{ summary: AiDisclosureSummary }>) {
  const { summary } = props;
  return (
    <section className="ai-summary-preview" aria-labelledby="ai-summary-heading">
      <div className="ai-summary-preview__heading">
        <div><p className="eyebrow">원문 기반 분석</p><h2 id="ai-summary-heading">AI 핵심 요약</h2></div>
        <span className="ai-summary-preview__badge">요약 완료</span>
      </div>
      <div className="deep-report">
        <section className="deep-report__intro" aria-labelledby="quick-summary-heading">
          <div><h3 id="quick-summary-heading">{summary.plainSummary}</h3></div>
          <p>{summary.whyItMatters || "공시 원문의 핵심 내용을 간단히 정리했습니다."}</p>
          <dl>
            <div className="deep-report__context"><dt>기업</dt><dd>{props.companyName}</dd></div>
            <div className="deep-report__context"><dt>공시 유형</dt><dd>{props.eventTypeLabel}</dd></div>
            <div><dt>요약 생성</dt><dd>{formatKoreanTimestamp(summary.generatedAt)}</dd></div>
          </dl>
        </section>
        <section className="deep-report__evidence" aria-labelledby="quick-summary-evidence-heading">
          <div>
            <p className="eyebrow">근거 확인</p>
            <h3 id="quick-summary-evidence-heading">중요한 판단 전 공시 원문을 확인하세요</h3>
            <p>{props.reportName} · {props.disclosedOn} · 접수번호 {props.receiptNumber}</p>
          </div>
          <div className="deep-report__evidence-actions">
            <Link href="#filing-documents">수집된 문서 보기</Link>
            <a href={props.originalUrl} target="_blank" rel="noopener noreferrer">OpenDART 원문</a>
          </div>
        </section>
      </div>
      <p className="ai-summary-preview__notice">
        이 요약은 생성형 AI가 공시 원문을 바탕으로 작성했으며 오류가 있을 수 있습니다. 투자 권유가 아니며, 중요한 판단 전 OpenDART 원문을 확인하세요.
      </p>
    </section>
  );
}

function AiDeepReport(props: Props & Readonly<{ summary: AiDisclosureSummary }>) {
  const { summary } = props;
  const verifiedFacts = summary.verifiedFacts.filter((fact) => fact.verificationStatus === "VERIFIED");
  const importanceScore = Math.max(0, Math.min(100, Math.round(summary.importanceScore)));

  return (
    <section className="ai-summary-preview" aria-labelledby="ai-summary-heading">
      <div className="ai-summary-preview__heading">
        <div>
          <p className="eyebrow">원문 기반 분석</p>
          <h2 id="ai-summary-heading">AI 심층 리포트</h2>
        </div>
        <span className="ai-summary-preview__badge">분석 완료</span>
      </div>

      <div className="deep-report">
        <section className="deep-report__intro" aria-labelledby="deep-report-summary-heading">
          <div>
            <h3 id="deep-report-summary-heading">{summary.plainSummary}</h3>
            <span>중요도 {importanceScore}/100</span>
          </div>
          <p>{summary.whyItMatters || "별도의 중요성 해설이 생성되지 않았습니다."}</p>
          <dl>
            <div className="deep-report__context"><dt>기업</dt><dd>{props.companyName}</dd></div>
            <div className="deep-report__context"><dt>공시 유형</dt><dd>{props.eventTypeLabel}</dd></div>
            <div><dt>분석 생성</dt><dd>{formatKoreanTimestamp(summary.generatedAt)}</dd></div>
          </dl>
        </section>

        <ReportList
          eyebrow="투자자 확인 항목"
          heading="이 공시에서 확인할 변화"
          badge="AI 해석"
          items={summary.checkpoints}
          emptyText="별도로 생성된 확인 항목이 없습니다. 공시 원문을 확인해 주세요."
        />

        <VerifiedFacts facts={verifiedFacts} receiptNumber={props.receiptNumber} />

        <ReportList
          eyebrow="판단 전 주의"
          heading="해석할 때 유의할 점"
          badge="주의"
          items={summary.cautions}
          emptyText="별도로 생성된 주의사항이 없습니다. 중요한 판단 전 원문을 확인해 주세요."
          caution
        />

        <section className="deep-report__evidence" aria-labelledby="deep-report-evidence-heading">
          <div>
            <p className="eyebrow">근거 확인</p>
            <h3 id="deep-report-evidence-heading">AI 해석과 공시 원문을 함께 확인하세요</h3>
            <p>{props.reportName} · {props.disclosedOn} · 접수번호 {props.receiptNumber}</p>
          </div>
          <div className="deep-report__evidence-actions">
            <Link href="#filing-documents">수집된 문서 보기</Link>
            <a href={props.originalUrl} target="_blank" rel="noopener noreferrer">OpenDART 원문</a>
          </div>
        </section>
      </div>

      <p className="ai-summary-preview__notice">
        이 해설은 생성형 AI가 공시 원문을 바탕으로 작성했습니다. 실제 저장되고 검증 절차를 거친 분석 결과만 표시하지만 오류가 있을 수 있습니다. 투자 권유가 아니며, 중요한 판단 전 OpenDART 원문을 확인하세요.
      </p>
    </section>
  );
}

function ReportList({ eyebrow, heading, badge, items, emptyText, caution = false }: Readonly<{
  eyebrow: string;
  heading: string;
  badge: string;
  items: readonly string[];
  emptyText: string;
  caution?: boolean;
}>) {
  return (
    <section className="deep-report__section">
      <div className="deep-report__section-heading">
        <span aria-hidden="true">{caution ? "!" : "→"}</span>
        <div><p>{eyebrow}</p><h3>{heading}</h3></div>
      </div>
      {items.length > 0 ? (
        <ul className="deep-report__findings">
          {items.map((item) => (
            <li key={item}>
              <span className={`evidence-badge${caution ? " evidence-badge--caution" : " evidence-badge--interpretation"}`}>{badge}</span>
              <p>{item}</p>
            </li>
          ))}
        </ul>
      ) : <p className="deep-report__empty-note">{emptyText}</p>}
    </section>
  );
}

function VerifiedFacts({ facts, receiptNumber }: Readonly<{ facts: readonly VerifiedDisclosureFact[]; receiptNumber: string }>) {
  return (
    <section className="deep-report__section" aria-labelledby="verified-facts-heading">
      <div className="deep-report__section-heading">
        <span aria-hidden="true">✓</span>
        <div><p>원문 대조 완료</p><h3 id="verified-facts-heading">공시에서 확인된 핵심 숫자</h3></div>
      </div>
      {facts.length > 0 ? (
        <div className="deep-report__number-table" role="table" aria-label="원문에서 확인된 핵심 숫자">
          <div className="deep-report__number-row deep-report__number-row--head" role="row">
            <span role="columnheader">항목</span><span role="columnheader">확인된 값</span><span role="columnheader">원문 근거</span>
          </div>
          {facts.map((fact) => (
            <div className="deep-report__number-row" role="row" key={`${fact.source.documentId}:${fact.source.startOffset}:${fact.value}`}>
              <strong role="cell">{fact.label}<small>{getFactKindLabel(fact.kind)}</small></strong>
              <span role="cell">{fact.value} {fact.unit}</span>
              <span role="cell">
                <q>{fact.sourceQuote}</q>
                <Link href={`/disclosures/${receiptNumber}/documents/${fact.source.documentId}`}>
                  {fact.source.documentTitle} · 원문 위치 {fact.source.startOffset.toLocaleString("ko-KR")}–{fact.source.endOffset.toLocaleString("ko-KR")}
                </Link>
              </span>
            </div>
          ))}
        </div>
      ) : <p className="deep-report__empty-note">이 분석에서 원문과 자동 대조가 완료된 숫자는 없습니다.</p>}
    </section>
  );
}

function getFactKindLabel(kind: DisclosureFactKind): string {
  if (kind === "AMOUNT") return "금액";
  if (kind === "PERCENTAGE") return "비율";
  if (kind === "QUANTITY") return "수량";
  return "기간";
}

function AiSummaryStatus(props: Props) {
  const status = props.state.status === "READY" ? "NOT_GENERATED" : props.state.status;
  const content = status === "NOT_GENERATED" && props.documentStatus && props.documentStatus !== "READY"
    ? getDocumentPendingContent(props.documentStatus)
    : STATUS_CONTENT[status];
  const updatedAt = "updatedAt" in props.state ? props.state.updatedAt : null;
  return (
    <section className="ai-summary-preview" aria-labelledby="ai-summary-heading">
      <div className="ai-summary-preview__heading">
        <div><p className="eyebrow">원문 기반 분석</p><h2 id="ai-summary-heading">AI 공시 해설</h2></div>
        <span className="ai-summary-preview__badge">{content.badge}</span>
      </div>
      <div className="empty-state" role="status">
        <strong>{content.title}</strong>
        <p>{content.description}</p>
        {updatedAt ? <small>마지막 상태 변경: {formatKoreanTimestamp(updatedAt)}</small> : null}
        <a className="primary-link" href={props.originalUrl} target="_blank" rel="noopener noreferrer">OpenDART 원문 보기</a>
      </div>
    </section>
  );
}

const STATUS_CONTENT = {
  NOT_GENERATED: {
    badge: "요약 대기",
    title: "AI 요약을 순차적으로 준비합니다.",
    description: "공시 원문이 준비된 공개 공시부터 차례로 요약합니다. 아래 제출 문서와 OpenDART 원문은 바로 확인할 수 있습니다.",
  },
  PENDING: {
    badge: "준비 예정",
    title: "AI 해설을 준비하고 있습니다.",
    description: "공시 원문과 제출 문서는 먼저 확인할 수 있으며, 해설은 검증이 끝난 뒤 표시합니다.",
  },
  PROCESSING: {
    badge: "해설 작성 중",
    title: "공시 내용을 확인하고 있습니다.",
    description: "공시 원문은 정상적으로 이용할 수 있습니다. AI 해설은 검증을 마치는 대로 표시합니다.",
  },
  FAILED: {
    badge: "준비 지연",
    title: "AI 해설 준비가 지연되고 있습니다.",
    description: "공시 데이터의 오류가 아닙니다. 원문과 제출 문서는 정상적으로 확인할 수 있으며, 검증되지 않은 해설은 표시하지 않습니다.",
  },
  UNAVAILABLE: {
    badge: "상태 확인 지연",
    title: "AI 해설 상태를 불러오지 못했습니다.",
    description: "AI 분석 실패를 의미하지 않습니다. 공시 원문과 제출 문서는 정상적으로 확인할 수 있으며, 잠시 후 다시 확인해 주세요.",
  },
} as const;

function getDocumentPendingContent(status: DisclosureDocumentCollectionStatus) {
  if (status === "UNAVAILABLE") return {
    badge: "원문 미제공",
    title: "AI 해설에 필요한 문서를 확인할 수 없습니다.",
    description: "OpenDART 원문에서 공시 내용을 직접 확인해 주세요.",
  } as const;
  if (status === "FAILED") return {
    badge: "원문 수집 지연",
    title: "제출 문서 수집이 지연되고 있습니다.",
    description: "AI 해설은 원문이 수집된 뒤 중요 공시부터 생성됩니다. 현재는 OpenDART 원문을 확인해 주세요.",
  } as const;
  return {
    badge: "원문 수집 중",
    title: "AI 해설에 필요한 제출 문서를 수집하고 있습니다.",
    description: "원문이 준비되면 중요 공시부터 해설합니다. 현재는 OpenDART 원문을 확인해 주세요.",
  } as const;
}

function formatKoreanTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시간 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

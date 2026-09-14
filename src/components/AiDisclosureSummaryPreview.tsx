"use client";

import Link from "next/link";
import React, { useState } from "react";
import type { AiDisclosureSummary, AiDisclosureSummaryState } from "@/domain/ai-disclosure-summary";
import type { DisclosureFactKind, VerifiedDisclosureFact } from "@/domain/ai-disclosure-facts";

type Props = Readonly<{
  companyName: string;
  reportName: string;
  disclosedOn: string;
  eventTypeLabel: string;
  originalUrl: string;
  receiptNumber: string;
  state: AiDisclosureSummaryState;
}>;

type SummarySlide = Readonly<{
  eyebrow: string;
  title: string;
  items: readonly string[];
}>;

type SummaryContext = Pick<Props, "companyName" | "reportName" | "disclosedOn" | "eventTypeLabel">;

export function AiDisclosureSummaryPreview(props: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (props.state.status !== "READY") return <AiSummaryStatus {...props} />;

  const slides = createSummarySlides(props, props.state.summary);
  const verifiedFacts = props.state.summary.verifiedFacts.filter((fact) => fact.verificationStatus === "VERIFIED");
  const activeSlide = slides[activeIndex] ?? slides[0];

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  };

  return (
    <section className="ai-summary-preview" aria-labelledby="ai-summary-heading">
      <div className="ai-summary-preview__heading">
        <div>
          <p className="eyebrow">빠르게 이해하기</p>
          <h2 id="ai-summary-heading">AI 공시 분석</h2>
        </div>
        <span className="ai-summary-preview__badge">AI 생성</span>
      </div>

      <div className="ai-summary-preview__viewport" role="region" aria-roledescription="carousel" aria-label="AI 요약">
        <article className="ai-summary-preview__slide" aria-live="polite">
          <p>{activeSlide.eyebrow}</p>
          <h3>{activeSlide.title}</h3>
          <ul>{activeSlide.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>

        <div className="ai-summary-preview__controls">
          <button type="button" onClick={() => move(-1)} aria-label="이전 요약">←</button>
          <div className="ai-summary-preview__progress" aria-label={`${activeIndex + 1} / ${slides.length}`}>
            {slides.map((slide, index) => (
              <button
                key={slide.eyebrow}
                type="button"
                className={index === activeIndex ? "is-active" : undefined}
                onClick={() => setActiveIndex(index)}
                aria-label={`${index + 1}번째 요약 보기`}
                aria-current={index === activeIndex ? "true" : undefined}
              />
            ))}
          </div>
          <strong>{activeIndex + 1} / {slides.length}</strong>
          <button type="button" onClick={() => move(1)} aria-label="다음 요약">→</button>
        </div>
      </div>

      <p className="ai-summary-preview__notice">
        AI가 생성한 참고용 요약입니다. 중요한 판단 전 <a href={props.originalUrl} target="_blank" rel="noopener noreferrer">OpenDART 원문</a>을 확인하세요.
      </p>
      {verifiedFacts.length > 0 ? <VerifiedFacts facts={verifiedFacts} receiptNumber={props.receiptNumber} /> : null}
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
  const content = STATUS_CONTENT[props.state.status === "READY" ? "NOT_GENERATED" : props.state.status];
  return (
    <section className="ai-summary-preview" aria-labelledby="ai-summary-heading">
      <div className="ai-summary-preview__heading">
        <div><p className="eyebrow">빠르게 이해하기</p><h2 id="ai-summary-heading">AI 공시 분석</h2></div>
        <span className="ai-summary-preview__badge">{content.badge}</span>
      </div>
      <div className="empty-state" role="status">
        <strong>{content.title}</strong>
        <p>{content.description}</p>
        <a className="primary-link" href={props.originalUrl} target="_blank" rel="noopener noreferrer">OpenDART 원문 보기</a>
      </div>
    </section>
  );
}

const STATUS_CONTENT = {
  NOT_GENERATED: {
    badge: "분석 미생성",
    title: "AI 요약이 아직 생성되지 않았습니다.",
    description: "생성된 분석 내용이 없으므로 현재는 공시 원문만 제공합니다.",
  },
  PENDING: {
    badge: "분석 대기",
    title: "AI 요약을 준비하고 있습니다.",
    description: "생성이 완료되기 전에는 분석 내용을 표시하지 않습니다.",
  },
  FAILED: {
    badge: "분석 확인 불가",
    title: "AI 요약을 표시할 수 없습니다.",
    description: "자동 분석 결과 대신 OpenDART 원문을 확인해 주세요.",
  },
} as const;

export function createSummarySlides({ companyName, reportName, disclosedOn, eventTypeLabel }: SummaryContext, summary: AiDisclosureSummary): readonly [SummarySlide, SummarySlide, SummarySlide] {
  return [
    {
      eyebrow: "한 줄 요약",
      title: `${companyName} · ${eventTypeLabel}`,
      items: [summary.plainSummary, `공시명: ${reportName}`, `공시일: ${disclosedOn}`],
    },
    {
      eyebrow: "왜 중요한가요?",
      title: "투자자가 살펴볼 변화",
      items: [summary.whyItMatters, ...summary.checkpoints].slice(0, 4),
    },
    {
      eyebrow: "투자자 체크",
      title: "원문에서 확인할 항목",
      items: summary.cautions,
    },
  ];
}

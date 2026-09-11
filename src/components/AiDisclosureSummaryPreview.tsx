"use client";

import React, { useState } from "react";
import type { AiDisclosureSummary } from "@/domain/ai-disclosure-summary";

type Props = Readonly<{
  companyName: string;
  reportName: string;
  disclosedOn: string;
  eventTypeLabel: string;
  summary?: AiDisclosureSummary | null;
}>;

type SummarySlide = Readonly<{
  eyebrow: string;
  title: string;
  items: readonly string[];
}>;

export function AiDisclosureSummaryPreview(props: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const slides = props.summary ? createSummarySlides(props) : createPreviewSlides(props);
  const activeSlide = slides[activeIndex] ?? slides[0];

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  };

  return (
    <section className="ai-summary-preview" aria-labelledby="ai-summary-heading">
      <div className="ai-summary-preview__heading">
        <div>
          <p className="eyebrow">빠르게 이해하기</p>
          <h2 id="ai-summary-heading">AI 공시 요약</h2>
        </div>
        <span className="ai-summary-preview__badge">{props.summary ? "AI 생성" : "예시 화면"}</span>
      </div>

      <div className="ai-summary-preview__viewport" role="region" aria-roledescription="carousel" aria-label="AI 요약 미리보기">
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
        {props.summary ? "AI가 생성한 참고용 요약입니다. 중요한 판단 전 원문을 확인하세요." : "현재는 화면 예시입니다. API 연동 후 공시 원문을 기준으로 자동 생성됩니다."}
      </p>
    </section>
  );
}

function createSummarySlides({ companyName, reportName, disclosedOn, eventTypeLabel, summary }: Props): readonly [SummarySlide, SummarySlide, SummarySlide] {
  if (!summary) return createPreviewSlides({ companyName, reportName, disclosedOn, eventTypeLabel });
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

function createPreviewSlides({ companyName, reportName, disclosedOn, eventTypeLabel }: Props): readonly [SummarySlide, SummarySlide, SummarySlide] {
  return [
    {
      eyebrow: "한 줄 요약",
      title: `${companyName} · ${eventTypeLabel}`,
      items: [`공시명: ${reportName}`, `공시일: ${disclosedOn}`, "핵심 변화와 수치는 원문 확인이 필요합니다."],
    },
    {
      eyebrow: "무엇이 달라졌나요?",
      title: "투자 판단에 영향을 줄 변화부터 짧게 정리합니다.",
      items: ["이전 공시·실적과 달라진 내용", "금액·기간·비율 등 핵심 숫자", "회사에 미칠 수 있는 긍정·부정 요인"],
    },
    {
      eyebrow: "투자자 체크",
      title: "요약만 믿지 않고 원문에서 확인할 항목입니다.",
      items: ["조건과 예외 조항", "정정공시 또는 첨부문서 여부", "회사가 직접 밝힌 위험 요인"],
    },
  ];
}

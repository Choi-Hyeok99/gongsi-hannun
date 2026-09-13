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
  const [activeView, setActiveView] = useState<"summary" | "report">("summary");
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
          <h2 id="ai-summary-heading">AI 공시 분석</h2>
        </div>
        <span className="ai-summary-preview__badge">{props.summary ? "AI 생성" : "예시 화면"}</span>
      </div>

      <div className="ai-analysis-tabs" role="tablist" aria-label="AI 분석 보기">
        <button id="ai-summary-tab" type="button" role="tab" aria-selected={activeView === "summary"} aria-controls="ai-summary-panel" onClick={() => setActiveView("summary")}>한눈 요약</button>
        <button id="ai-report-tab" type="button" role="tab" aria-selected={activeView === "report"} aria-controls="ai-report-panel" onClick={() => setActiveView("report")}>심층 리포트</button>
        <a href="#filing-documents">원문 보기</a>
      </div>

      <div id="ai-summary-panel" role="tabpanel" aria-labelledby="ai-summary-tab" hidden={activeView !== "summary"}>
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
      </div>

      <DeepReportPreview {...props} hidden={activeView !== "report"} />
    </section>
  );
}

function DeepReportPreview({ companyName, reportName, disclosedOn, summary, hidden }: Props & Readonly<{ hidden: boolean }>) {
  const findings = summary
    ? [summary.plainSummary, ...summary.checkpoints].slice(0, 3)
    : [`${companyName}이 ${reportName}을 제출했습니다.`, "핵심 변화와 수치는 심층 분석 연결 후 표시됩니다.", "정정·첨부문서까지 함께 비교할 예정입니다."];
  const opportunities = summary?.checkpoints.length ? summary.checkpoints : ["사업 또는 재무에 미치는 영향을 이전 공시와 비교합니다."];
  const risks = summary?.cautions.length ? summary.cautions : ["미확정 조건과 예외 조항은 원문에서 다시 확인해야 합니다."];

  return (
    <div id="ai-report-panel" className="deep-report" role="tabpanel" aria-labelledby="ai-report-tab" hidden={hidden}>
      <header className="deep-report__intro">
        <div><span>심층 리포트 구성 예시</span><h3>{companyName} 공시를 더 깊게 읽기</h3></div>
        <p>현재는 화면 구성 검증 단계입니다. 실제 심층 분석 API를 연결하기 전까지 표시된 해석을 투자 판단에 사용하지 마세요.</p>
        <dl><div><dt>분석 대상</dt><dd>주 문서 본문</dd></div><div><dt>기준일</dt><dd>{disclosedOn}</dd></div><div><dt>비교 범위</dt><dd>이전·정정 공시 예정</dd></div></dl>
      </header>

      <section className="deep-report__section" aria-labelledby="deep-change-heading">
        <div className="deep-report__section-heading"><span>01</span><div><p>먼저 볼 내용</p><h4 id="deep-change-heading">이번 공시에서 달라진 점</h4></div></div>
        <ol className="deep-report__findings">{findings.map((finding, index) => <li key={`${finding}-${index}`}><span className={`evidence-badge ${index === 1 ? "evidence-badge--interpretation" : ""}`}>{index === 1 ? "AI 해석" : "공시 사실"}</span><p>{finding}</p></li>)}</ol>
      </section>

      <section className="deep-report__section" aria-labelledby="deep-number-heading">
        <div className="deep-report__section-heading"><span>02</span><div><p>숫자로 비교</p><h4 id="deep-number-heading">핵심 숫자 변화</h4></div></div>
        <div className="deep-report__number-table" role="table" aria-label="핵심 숫자 비교 예시">
          <div className="deep-report__number-row deep-report__number-row--head" role="row"><span role="columnheader">항목</span><span role="columnheader">현재</span><span role="columnheader">이전·증감</span></div>
          {["핵심 금액", "비율·수량", "영향 기간"].map((label) => <div className="deep-report__number-row" role="row" key={label}><strong role="cell">{label}</strong><span role="cell">원문 분석 후 표시</span><span role="cell"><em>계산</em> 비교 데이터 준비 중</span></div>)}
        </div>
        <p className="deep-report__empty-note">수치가 없으면 임의로 추정하지 않고 ‘공시에서 확인되지 않음’으로 표시합니다.</p>
      </section>

      <section className="deep-report__section" aria-labelledby="deep-impact-heading">
        <div className="deep-report__section-heading"><span>03</span><div><p>균형 있게 보기</p><h4 id="deep-impact-heading">기회 요인과 위험 요인</h4></div></div>
        <div className="deep-report__impact-grid">
          <article><span className="evidence-badge evidence-badge--interpretation">AI 해석</span><h5>기회 요인</h5><ul>{opportunities.map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article className="deep-report__impact-card--risk"><span className="evidence-badge evidence-badge--caution">확인 필요</span><h5>위험 요인</h5><ul>{risks.map((item) => <li key={item}>{item}</li>)}</ul></article>
        </div>
      </section>

      <section className="deep-report__section" aria-labelledby="deep-followup-heading">
        <div className="deep-report__section-heading"><span>04</span><div><p>놓치지 않기</p><h4 id="deep-followup-heading">조건과 다음 확인 시점</h4></div></div>
        <div className="deep-report__followups">
          <details open><summary>확정되지 않은 조건</summary><p>금액·일정·승인·계약 조건을 분리하고, 공시에 없는 내용은 확인되지 않았다고 표시합니다.</p></details>
          <details><summary>다음에 확인할 공시</summary><p>후속 공시, 정정공시, 실적 반영 시점을 날짜순 체크리스트로 제공합니다.</p></details>
          <details><summary>반대 가능성</summary><p>긍정 또는 부정 한쪽으로 단정하지 않고 결과가 달라질 수 있는 조건을 함께 보여줍니다.</p></details>
        </div>
      </section>

      <section className="deep-report__evidence" aria-labelledby="deep-evidence-heading">
        <div><span className="evidence-badge">원문 근거</span><h4 id="deep-evidence-heading">근거를 직접 확인하세요</h4><p>실제 리포트에는 문장마다 참조한 본문·첨부문서와 해당 위치가 연결됩니다.</p></div>
        <a href="#filing-documents">본문과 첨부문서 보기 →</a>
      </section>
    </div>
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

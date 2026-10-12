import type { AiAnalysisCandidate } from "@/domain/ai-disclosure-summary";
import { getDisclosureEventTypeLabel } from "@/domain/disclosure-classification";

export const CORPORATE_AI_EVENT_TYPES = ["EARNINGS", "SUPPLY_CONTRACT", "FACILITY_EXPANSION", "INVESTMENT", "FUNDRAISING", "CAPITAL_CHANGE"] as const;
const CORPORATE_EVENTS = new Set<string>(CORPORATE_AI_EVENT_TYPES);
const FINANCIAL_LABELS = ["매출액", "영업이익", "당기순이익", "자산총계", "부채총계", "자본총계", "계약금액", "투자금액", "발행총액", "발행가액", "발행주식총수", "총발행주식수"] as const;
const UNIT = "(?:조원|억원|천만원|백만원|만원|천원|원|USD|달러|주|%)";
const NUMBER = "[-+]?(?:\\d{1,3}(?:,\\d{3})+|\\d{1,18})(?:\\.\\d{1,6})?";
type CorporateFact = Readonly<{label:string; value:string; unit:string|null; sourceQuote:string}>;

/** Fail closed: transmit only allowlisted financial expressions, never arbitrary filing text. */
export function corporateAiInput(candidate: AiAnalysisCandidate): Readonly<{company:string;date:string;type:string;facts:readonly CorporateFact[]}> | null {
  if (!CORPORATE_EVENTS.has(candidate.eventType) || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.disclosedOn)) return null;
  const facts: CorporateFact[] = [];
  const seen = new Set<string>();
  for (const label of FINANCIAL_LABELS) {
    const pattern = new RegExp(`(?:^|[\\s|])(${label}\\s*(?:\\((${UNIT})\\))?\\s*[:：|]?\\s*(${NUMBER})\\s*(${UNIT})?)(?=$|[\\s|,;.()])`, "g");
    for (const match of candidate.contentText.matchAll(pattern)) {
      const quote = match[1];
      const value = match[3];
      if (!quote || !value) continue;
      const unit = match[4] ?? match[2] ?? null;
      const identity = `${label}:${value}:${unit}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      facts.push({label,value,unit,sourceQuote:quote.trim()});
      if (facts.length >= 12) break;
    }
    if (facts.length >= 12) break;
  }
  if (!facts.length) return null;
  // Company names originate from the listed-company registry, not the filing's submitter/person fields.
  return {company:candidate.companyName.slice(0,100),date:candidate.disclosedOn,type:getDisclosureEventTypeLabel(candidate.eventType),facts};
}

export function buildCorporateAiPrompt(candidate: AiAnalysisCandidate): string {
  const input = corporateAiInput(candidate);
  if (!input) throw new Error("AI_NO_SAFE_INPUT");
  return [
    "아래 기업·재무 사실만 지정된 JSON 형식으로 짧고 쉬운 한국어로 요약하세요. 공시 전체 본문은 제공되지 않았습니다.",
    "개인 이름·개인별 보유내역·연락처·주소는 입력에 없습니다. 이를 추론하거나 생성하지 마세요.",
    "요약은 2문장, 확인 항목 최대 2개, 주의사항 1개입니다. 주가 전망, 투자 권유, 효과나 의도 단정을 금지합니다.",
    "입력의 단위가 null이면 단위를 추측하지 말고 원문 확인이 필요하다고 적으세요. 여러 기간의 값일 수 있으므로 비교·증감률을 계산하지 마세요.",
    "factCandidates는 sourceQuote에 value와 unit이 실제로 함께 존재할 때만 작성하고 표기를 그대로 복사하세요. 없다면 빈 배열을 반환하세요.",
    "반드시 공시 전체의 맥락·거래조건은 공식 원문에서 확인해야 한다는 주의사항을 포함하세요.",
    JSON.stringify(input),
  ].join("\n");
}

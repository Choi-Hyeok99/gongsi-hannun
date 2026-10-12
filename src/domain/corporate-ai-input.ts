import type { AiAnalysisCandidate } from "@/domain/ai-disclosure-summary";
import { DISCLOSURE_EVENT_TYPES, getDisclosureEventTypeLabel } from "@/domain/disclosure-classification";

export const CORPORATE_AI_EVENT_TYPES = DISCLOSURE_EVENT_TYPES;
const CORPORATE_EVENTS = new Set<string>(CORPORATE_AI_EVENT_TYPES);
const FINANCIAL_LABELS = ["매출액", "영업이익", "당기순이익", "자산총계", "부채총계", "자본총계", "계약금액", "투자금액", "발행총액", "발행가액", "발행주식총수", "총발행주식수", "자본금", "자기자본", "취득금액", "양수금액", "양도금액", "배당금총액", "주당배당금", "배당성향", "부채비율", "증자비율", "합병비율", "분할비율", "신주발행주식수", "소각예정주식수"] as const;
const UNIT = "(?:조원|억원|천만원|백만원|만원|천원|원|USD|달러|주|%)";
const NUMBER = "[-+]?(?:\\d{1,3}(?:,\\d{3})+|\\d{1,18})(?:\\.\\d{1,6})?";
type CorporateFact = Readonly<{label:string; value:string; unit:string|null; sourceQuote:string}>;
type CorporateDetail = Readonly<{label:string;value:string;sourceQuote:string}>;
const OWNERSHIP_EVENTS = new Set<string>(["INSIDER_OWNERSHIP_CHANGE", "SHAREHOLDER_CHANGE"]);
const ISSUER_SHARE_LABELS = new Set<string>(["발행주식총수", "총발행주식수"]);
const DATE_LABELS = ["합병기일", "분할기일", "납입일", "납입기일", "신주상장예정일", "배당기준일", "배당금지급예정일", "주주총회예정일", "주주총회일자", "계약시작일", "계약종료일"] as const;
const DATE_VALUE = "(?:20\\d{2}[-./]\\s*\\d{1,2}[-./]\\s*\\d{1,2}\\.?|20\\d{2}년\\s*\\d{1,2}월\\s*\\d{1,2}일)";

/** Fail closed: transmit only allowlisted financial expressions, never arbitrary filing text. */
export function corporateAiInput(candidate: AiAnalysisCandidate): Readonly<{company:string;date:string;type:string;facts:readonly CorporateFact[];details:readonly CorporateDetail[]}> | null {
  if (!CORPORATE_EVENTS.has(candidate.eventType) || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.disclosedOn)) return null;
  const facts: CorporateFact[] = [];
  const seen = new Set<string>();
  for (const label of FINANCIAL_LABELS) {
    // Acquisition amounts in an ownership filing may describe a natural person's finances.
    if (OWNERSHIP_EVENTS.has(candidate.eventType) && !ISSUER_SHARE_LABELS.has(label)) continue;
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
  const details: CorporateDetail[] = [];
  for (const label of DATE_LABELS) {
    if (OWNERSHIP_EVENTS.has(candidate.eventType)) continue;
    const pattern = new RegExp(`(?:^|[\\s|])(${label}\\s*[:：|]?\\s*(${DATE_VALUE}))(?=$|[\\s|,;])`, "g");
    for (const match of candidate.contentText.matchAll(pattern)) {
      const value=match[2];const quote=match[1];
      if (!value || !quote || !isValidCorporateDate(value)) continue;
      if (!details.some(item=>item.label===label&&item.value===value)) details.push({label,value,sourceQuote:quote});
      if (details.length >= 8) break;
    }
    if (details.length >= 8) break;
  }
  const opinion = /(?:^|[\s|])(감사의견\s*[:：|]?\s*(적정|한정|부적정|의견거절))(?=$|[\r\n|])/g;
  for (const match of OWNERSHIP_EVENTS.has(candidate.eventType) ? [] : candidate.contentText.matchAll(opinion)) {
    if (match[1] && match[2] && details.length < 8) details.push({label:"감사의견",value:match[2],sourceQuote:match[1]});
  }
  if (!facts.length && !details.length) return null;
  // Company names originate from the listed-company registry, not the filing's submitter/person fields.
  return {company:candidate.companyName.slice(0,100),date:candidate.disclosedOn,type:getDisclosureEventTypeLabel(candidate.eventType),facts,details};
}

export function buildCorporateAiPrompt(candidate: AiAnalysisCandidate): string {
  const input = corporateAiInput(candidate);
  if (!input) throw new Error("AI_NO_SAFE_INPUT");
  return [
    "아래 기업·재무 사실만 지정된 JSON 형식으로 짧고 쉬운 한국어로 요약하세요. 공시 전체 본문은 제공되지 않았습니다.",
    "개인 이름·개인별 보유내역·연락처·주소는 입력에 없습니다. 이를 추론하거나 생성하지 마세요.",
    "요약은 2문장, 확인 항목 최대 2개, 주의사항 1개입니다. 주가 전망, 투자 권유, 효과나 의도 단정을 금지합니다.",
    "수치의 주체가 제출기업인지 계약 상대방인지, 대상 기간이 언제인지는 입력에 없을 수 있습니다. 이런 값을 제출기업의 당일 실적이나 확정 성과로 단정하지 마세요. 개인 보유 변동 방향·거래 이유·보유금액은 입력에 없으므로 해설하거나 추측하지 마세요.",
    "입력의 단위가 null이면 숫자를 요약에 나열하거나 단위를 추측하지 말고 원문 확인이 필요하다고 적으세요. 여러 기간의 값일 수 있으므로 비교·증감률을 계산하지 마세요. 일정·감사의견도 입력에 있는 내용만 설명하고 결정의 확정 여부나 조건을 추측하지 마세요.",
    "factCandidates는 sourceQuote에 value와 unit이 실제로 함께 존재할 때만 작성하고 표기를 그대로 복사하세요. 없다면 빈 배열을 반환하세요.",
    "반드시 공시 전체의 맥락·거래조건은 공식 원문에서 확인해야 한다는 주의사항을 포함하세요.",
    JSON.stringify(input),
  ].join("\n");
}

function isValidCorporateDate(value: string): boolean {
  const parts=value.match(/\d+/g);
  if (!parts || parts.length !== 3) return false;
  const [year,month,day]=parts.map(Number);
  if (!year || !month || !day) return false;
  const parsed=new Date(Date.UTC(year,month-1,day));
  return parsed.getUTCFullYear()===year && parsed.getUTCMonth()===month-1 && parsed.getUTCDate()===day;
}

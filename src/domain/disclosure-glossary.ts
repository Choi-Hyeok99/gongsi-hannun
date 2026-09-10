export type GlossaryEntry = Readonly<{
  term: string;
  aliases: readonly string[];
  meaning: string;
  context: string;
}>;

export const DISCLOSURE_GLOSSARY: readonly GlossaryEntry[] = [
  { term: "유상증자", aliases: ["유상증자"], meaning: "회사가 돈을 받고 새 주식을 발행해 자금을 마련하는 일입니다.", context: "발행 규모, 가격, 자금 사용처와 기존 주주의 지분 희석 가능성을 확인하세요." },
  { term: "무상증자", aliases: ["무상증자"], meaning: "주주에게 대가 없이 새 주식을 나눠주는 일입니다.", context: "주식 수는 늘지만 회사의 전체 가치가 그만큼 바로 늘어나는 것은 아닙니다." },
  { term: "전환사채", aliases: ["전환사채", "CB"], meaning: "일정 조건에서 회사 주식으로 바꿀 수 있는 채권입니다.", context: "전환가격과 발행 규모에 따라 향후 주식 수가 늘어날 수 있습니다." },
  { term: "신주인수권부사채", aliases: ["신주인수권부사채", "BW"], meaning: "새 주식을 살 수 있는 권리가 붙은 채권입니다.", context: "행사가격과 행사 기간, 잠재적인 지분 희석 규모를 확인하세요." },
  { term: "교환사채", aliases: ["교환사채", "EB"], meaning: "회사가 보유한 다른 주식으로 바꿀 수 있는 채권입니다.", context: "교환 대상 주식과 가격, 회사 보유지분 변화가 핵심입니다." },
  { term: "감자", aliases: ["감자결정", "감자"], meaning: "회사가 발행한 주식 수나 자본금을 줄이는 일입니다.", context: "결손 보전 목적과 주주에게 현금을 돌려주는 목적을 구분해 확인하세요." },
  { term: "자기주식", aliases: ["자기주식", "자사주"], meaning: "회사가 직접 보유한 자기 회사 주식입니다.", context: "취득·처분·소각 여부에 따라 의미가 달라집니다." },
  { term: "단일판매·공급계약", aliases: ["단일판매ㆍ공급계약", "단일판매·공급계약", "공급계약"], meaning: "회사가 일정 금액의 제품이나 서비스를 공급하기로 한 계약입니다.", context: "계약금액이 최근 매출에서 차지하는 비율과 계약기간을 확인하세요." },
  { term: "잠정실적", aliases: ["잠정실적", "영업실적"], meaning: "회사가 결산 확정 전에 먼저 발표한 예상 실적입니다.", context: "감사나 결산 과정에서 최종 수치가 달라질 수 있습니다." },
  { term: "영업이익", aliases: ["영업이익"], meaning: "본업으로 벌어들인 이익에서 영업비용을 뺀 금액입니다.", context: "매출과 함께 이전 기간 대비 증감 원인을 살펴보세요." },
  { term: "당기순이익", aliases: ["당기순이익", "순이익"], meaning: "일정 기간의 모든 수익과 비용을 반영한 최종 이익입니다.", context: "일회성 손익이 포함됐는지 확인하면 실적을 더 정확히 볼 수 있습니다." },
  { term: "합병", aliases: ["합병결정", "회사합병", "합병"], meaning: "둘 이상의 회사가 하나의 회사로 결합하는 일입니다.", context: "합병비율, 일정과 기존 주주의 권리 변화를 확인하세요." },
  { term: "회사분할", aliases: ["분할합병", "회사분할", "분할결정"], meaning: "회사의 사업이나 재산 일부를 별도 회사로 나누는 일입니다.", context: "인적분할과 물적분할에 따라 기존 주주에게 미치는 영향이 다릅니다." },
  { term: "최대주주", aliases: ["최대주주"], meaning: "회사 주식을 가장 많이 보유해 영향력이 큰 주주입니다.", context: "변경 사유와 새 최대주주의 지분율을 확인하세요." },
  { term: "주주총회", aliases: ["주주총회", "주총"], meaning: "주주가 회사의 중요한 안건을 의결하는 회의입니다.", context: "개최일, 의안과 의결권 기준일을 확인하세요." },
  { term: "배당", aliases: ["현금배당", "주식배당", "배당"], meaning: "회사가 이익 일부를 주주에게 현금이나 주식으로 나누는 일입니다.", context: "배당금, 기준일과 지급 예정일을 함께 확인하세요." },
  { term: "기준일", aliases: ["기준일"], meaning: "배당이나 의결권을 받을 주주를 정하는 날짜입니다.", context: "실제 매수 시점과 결제일 차이가 있으므로 거래 일정을 함께 확인하세요." },
  { term: "주식분할", aliases: ["주식분할"], meaning: "한 주를 여러 주로 나눠 주식 수를 늘리고 주당 가격을 낮추는 일입니다.", context: "회사 전체 가치가 분할만으로 변하는 것은 아닙니다." },
  { term: "주식병합", aliases: ["주식병합"], meaning: "여러 주를 한 주로 합쳐 주식 수를 줄이는 일입니다.", context: "병합비율과 거래정지 기간을 확인하세요." },
  { term: "공개매수", aliases: ["공개매수"], meaning: "정해진 기간과 가격으로 다수 주주의 주식을 공개적으로 사들이는 절차입니다.", context: "매수가격, 기간, 목적과 상장 유지 여부를 확인하세요." },
];

export function findGlossaryEntry(alias: string): GlossaryEntry | undefined {
  return DISCLOSURE_GLOSSARY.find((entry) => entry.aliases.includes(alias));
}

export function findGlossaryEntriesInText(text: string): readonly GlossaryEntry[] {
  return DISCLOSURE_GLOSSARY.filter((entry) => entry.aliases.some((alias) => text.includes(alias)));
}

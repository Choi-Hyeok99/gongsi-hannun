import { describe, expect, it } from "vitest";
import { readVerifiedDisclosureFacts, verifyDisclosureFactCandidates } from "@/domain/ai-disclosure-facts";

const sourceDocument = {
  id: "document-1",
  title: "단일판매ㆍ공급계약체결",
  kind: "MAIN" as const,
  contentHash: "a".repeat(64),
};

describe("verifyDisclosureFactCandidates", () => {
  it("keeps only values and quotes that exist verbatim in the source document", () => {
    const contentText = "계약금액은 12,500,000,000 원이며 최근 매출액 대비 8.4 %입니다.";
    const facts = verifyDisclosureFactCandidates({ contentText, sourceDocument }, [
      { kind: "AMOUNT", label: "계약금액", value: "12,500,000,000", unit: "원", sourceQuote: "계약금액은 12,500,000,000 원이며" },
      { kind: "PERCENTAGE", label: "매출액 대비", value: "9.9", unit: "%", sourceQuote: "최근 매출액 대비 9.9 %입니다" },
    ]);

    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      label: "계약금액",
      value: "12,500,000,000",
      unit: "원",
      verificationStatus: "VERIFIED",
      source: { documentId: "document-1", contentHash: "a".repeat(64) },
    });
    expect(contentText.slice(facts[0]!.source.startOffset, facts[0]!.source.endOffset)).toBe(facts[0]!.sourceQuote);
  });

  it("rejects inferred numbers even when the quote itself exists", () => {
    expect(verifyDisclosureFactCandidates({ contentText: "계약기간은 2026년 9월부터입니다.", sourceDocument }, [
      { kind: "PERIOD", label: "계약기간", value: "12개월", unit: "개월", sourceQuote: "계약기간은 2026년 9월부터입니다." },
    ])).toEqual([]);
  });

  it("reads only structurally valid verified facts from storage", () => {
    const valid = verifyDisclosureFactCandidates({ contentText: "지분율은 15 %입니다.", sourceDocument }, [
      { kind: "PERCENTAGE", label: "지분율", value: "15", unit: "%", sourceQuote: "지분율은 15 %입니다." },
    ])[0]!;
    expect(readVerifiedDisclosureFacts([valid, { ...valid, verificationStatus: "UNVERIFIED" }])).toEqual([valid]);
  });
});

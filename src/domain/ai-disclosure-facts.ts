export const DISCLOSURE_FACT_KINDS = ["AMOUNT", "PERCENTAGE", "QUANTITY", "PERIOD"] as const;

export type DisclosureFactKind = typeof DISCLOSURE_FACT_KINDS[number];

export type DisclosureFactCandidate = Readonly<{
  kind: DisclosureFactKind;
  label: string;
  value: string;
  unit: string;
  sourceQuote: string;
}>;

export type DisclosureFactSource = Readonly<{
  documentId: string;
  documentTitle: string;
  documentKind: "MAIN" | "ATTACHMENT";
  contentHash: string;
  startOffset: number;
  endOffset: number;
}>;

export type VerifiedDisclosureFact = DisclosureFactCandidate & Readonly<{
  source: DisclosureFactSource;
  verificationStatus: "VERIFIED";
}>;

export type DisclosureFactSourceDocument = Readonly<{
  id: string;
  title: string;
  kind: "MAIN" | "ATTACHMENT";
  contentHash: string;
}>;

type FactVerificationInput = Readonly<{
  contentText: string;
  sourceDocument: DisclosureFactSourceDocument;
}>;

const MAX_VERIFIED_FACTS = 6;

export function verifyDisclosureFactCandidates(
  input: FactVerificationInput,
  candidates: readonly DisclosureFactCandidate[],
): readonly VerifiedDisclosureFact[] {
  if (!/^[0-9a-f]{64}$/.test(input.sourceDocument.contentHash)) return [];
  const normalizedDocument = normalizeWithOffsets(input.contentText);
  const verified: VerifiedDisclosureFact[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const label = candidate.label.trim();
    const value = candidate.value.trim();
    const unit = candidate.unit.trim();
    const requestedQuote = normalizeText(candidate.sourceQuote);
    const normalizedValue = normalizeText(value);
    const normalizedUnit = normalizeText(unit);
    if (!isFactKind(candidate.kind) || !isSafeText(label, 2, 80) || !isSafeText(value, 1, 80) || !isSafeText(unit, 1, 30)) continue;
    if (!isSafeText(requestedQuote, 4, 300) || !/\d/.test(value)) continue;
    if (!requestedQuote.includes(normalizedValue) || !requestedQuote.includes(normalizedUnit)) continue;

    const normalizedStart = normalizedDocument.text.indexOf(requestedQuote);
    if (normalizedStart < 0) continue;
    const normalizedEnd = normalizedStart + requestedQuote.length;
    const startOffset = normalizedDocument.offsets[normalizedStart];
    const finalCharacterOffset = normalizedDocument.offsets[normalizedEnd - 1];
    if (startOffset === undefined || finalCharacterOffset === undefined) continue;
    const endOffset = finalCharacterOffset + 1;
    const sourceQuote = input.contentText.slice(startOffset, endOffset);
    const identity = `${candidate.kind}:${value}:${unit}:${input.sourceDocument.id}:${startOffset}:${endOffset}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    verified.push({
      kind: candidate.kind,
      label,
      value,
      unit,
      sourceQuote,
      source: {
        documentId: input.sourceDocument.id,
        documentTitle: input.sourceDocument.title,
        documentKind: input.sourceDocument.kind,
        contentHash: input.sourceDocument.contentHash,
        startOffset,
        endOffset,
      },
      verificationStatus: "VERIFIED",
    });
    if (verified.length >= MAX_VERIFIED_FACTS) break;
  }

  return verified;
}

export function readVerifiedDisclosureFacts(value: unknown): readonly VerifiedDisclosureFact[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isStoredVerifiedFact).slice(0, MAX_VERIFIED_FACTS);
}

function isStoredVerifiedFact(value: unknown): value is VerifiedDisclosureFact {
  if (!value || typeof value !== "object") return false;
  const fact = value as Record<string, unknown>;
  const source = fact.source;
  if (!source || typeof source !== "object") return false;
  const locator = source as Record<string, unknown>;
  return fact.verificationStatus === "VERIFIED"
    && isFactKind(fact.kind)
    && isSafeText(fact.label, 2, 80)
    && isSafeText(fact.value, 1, 80)
    && isSafeText(fact.unit, 1, 30)
    && isSafeText(fact.sourceQuote, 4, 300)
    && isSafeText(locator.documentId, 1, 100)
    && isSafeText(locator.documentTitle, 1, 500)
    && (locator.documentKind === "MAIN" || locator.documentKind === "ATTACHMENT")
    && typeof locator.contentHash === "string"
    && /^[0-9a-f]{64}$/.test(locator.contentHash)
    && Number.isInteger(locator.startOffset)
    && Number.isInteger(locator.endOffset)
    && Number(locator.startOffset) >= 0
    && Number(locator.endOffset) > Number(locator.startOffset);
}

function isFactKind(value: unknown): value is DisclosureFactKind {
  return typeof value === "string" && DISCLOSURE_FACT_KINDS.some((kind) => kind === value);
}

function isSafeText(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string" && value.trim().length >= minimum && value.trim().length <= maximum;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeWithOffsets(value: string): Readonly<{ text: string; offsets: readonly number[] }> {
  let text = "";
  const offsets: number[] = [];
  let whitespaceOffset: number | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (/\s/.test(character)) {
      if (text.length > 0 && whitespaceOffset === null) whitespaceOffset = index;
      continue;
    }
    if (whitespaceOffset !== null) {
      text += " ";
      offsets.push(whitespaceOffset);
      whitespaceOffset = null;
    }
    text += character;
    offsets.push(index);
  }

  return { text, offsets };
}

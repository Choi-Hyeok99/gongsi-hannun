import { classifyDisclosureReport } from "@/domain/disclosure-classification";
import {
  decideEventVisibility,
  type DisclosureEventRepository,
  type EventMaterializationCounts,
  type EventSourceDisclosure,
  type MaterializedDisclosureEvent,
} from "@/domain/disclosure-event";

export async function materializeDisclosureEvents(
  repository: DisclosureEventRepository,
  batchSize = 300,
  disclosedOn?: string,
): Promise<EventMaterializationCounts> {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1_000) {
    throw new RangeError("이벤트 변환 배치 크기가 올바르지 않습니다.");
  }
  if (disclosedOn && !/^\d{4}-\d{2}-\d{2}$/.test(disclosedOn)) {
    throw new RangeError("이벤트 변환 날짜가 올바르지 않습니다.");
  }

  let afterId: string | null = null;
  let readCount = 0;
  let createdCount = 0;
  let updatedCount = 0;

  while (true) {
    const disclosures = await repository.findSourceBatch(afterId, batchSize, disclosedOn);
    if (disclosures.length === 0) break;

    const events = disclosures.map(toMaterializedEvent);
    const counts = await repository.upsertEvents(events);
    readCount += disclosures.length;
    createdCount += counts.createdCount;
    updatedCount += counts.updatedCount;
    afterId = disclosures.at(-1)!.id;

    if (disclosures.length < batchSize) break;
  }

  return { readCount, createdCount, updatedCount };
}

function toMaterializedEvent(disclosure: EventSourceDisclosure): MaterializedDisclosureEvent {
  const classification = classifyDisclosureReport(disclosure.reportName);
  return {
    sourceDisclosureId: disclosure.id,
    companyId: disclosure.companyId,
    eventType: classification.eventType,
    title: disclosure.reportName,
    occurredOn: disclosure.disclosedOn,
    occurredOnBasis: "DISCLOSED_ON",
    facts: { classificationRuleId: classification.matchedRuleId },
    ruleImportanceScore: classification.ruleImportanceScore,
    importanceReasons: classification.importanceReasons,
    importanceVersion: classification.importanceVersion,
    visibility: decideEventVisibility(disclosure.status, classification.eventType),
  };
}

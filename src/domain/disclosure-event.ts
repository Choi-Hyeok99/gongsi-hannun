import type { DisclosureEventType } from "@/domain/disclosure-classification";

export type SourceDisclosureStatus = "ACTIVE" | "CORRECTED" | "CANCELLED" | "REVIEW_REQUIRED";
export type EventVisibility = "PUBLIC" | "HIDDEN" | "REVIEW_REQUIRED";

export type EventSourceDisclosure = Readonly<{
  id: string;
  companyId: string;
  reportName: string;
  disclosedOn: string;
  status: SourceDisclosureStatus;
}>;

export type MaterializedDisclosureEvent = Readonly<{
  sourceDisclosureId: string;
  companyId: string;
  eventType: DisclosureEventType;
  title: string;
  occurredOn: string;
  occurredOnBasis: "DISCLOSED_ON";
  facts: Readonly<{ classificationRuleId: string }>;
  ruleImportanceScore: number;
  importanceReasons: readonly string[];
  importanceVersion: string;
  visibility: EventVisibility;
}>;

export type EventMaterializationCounts = Readonly<{
  readCount: number;
  createdCount: number;
  updatedCount: number;
}>;

export interface DisclosureEventRepository {
  findSourceBatch(afterId: string | null, limit: number): Promise<readonly EventSourceDisclosure[]>;
  upsertEvents(events: readonly MaterializedDisclosureEvent[]): Promise<Readonly<{ createdCount: number; updatedCount: number }>>;
}

export function decideEventVisibility(
  status: SourceDisclosureStatus,
  eventType: DisclosureEventType,
): EventVisibility {
  if (status === "CANCELLED" || status === "CORRECTED") return "HIDDEN";
  if (status === "REVIEW_REQUIRED" || eventType === "OTHER") return "REVIEW_REQUIRED";
  return "PUBLIC";
}

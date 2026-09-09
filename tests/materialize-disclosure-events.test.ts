import { describe, expect, it } from "vitest";
import type {
  DisclosureEventRepository,
  EventSourceDisclosure,
  MaterializedDisclosureEvent,
} from "@/domain/disclosure-event";
import { decideEventVisibility } from "@/domain/disclosure-event";
import { materializeDisclosureEvents } from "@/server/materialize-disclosure-events";

const disclosures: readonly EventSourceDisclosure[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    companyId: "10000000-0000-0000-0000-000000000001",
    reportName: "단일판매ㆍ공급계약체결",
    disclosedOn: "2026-09-09",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    companyId: "10000000-0000-0000-0000-000000000002",
    reportName: "기업설명회 개최",
    disclosedOn: "2026-09-09",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    companyId: "10000000-0000-0000-0000-000000000003",
    reportName: "유상증자결정",
    disclosedOn: "2026-09-10",
    status: "CORRECTED",
  },
];

class MemoryEventRepository implements DisclosureEventRepository {
  readonly events = new Map<string, MaterializedDisclosureEvent>();

  async findSourceBatch(afterId: string | null, limit: number): Promise<readonly EventSourceDisclosure[]> {
    return disclosures.filter((item) => !afterId || item.id > afterId).slice(0, limit);
  }

  async upsertEvents(events: readonly MaterializedDisclosureEvent[]): Promise<Readonly<{ createdCount: number; updatedCount: number }>> {
    let createdCount = 0;
    let updatedCount = 0;
    for (const event of events) {
      if (this.events.has(event.sourceDisclosureId)) updatedCount += 1;
      else createdCount += 1;
      this.events.set(event.sourceDisclosureId, event);
    }
    return { createdCount, updatedCount };
  }
}

describe("materializeDisclosureEvents", () => {
  it("classifies every source disclosure across batches and applies public policy", async () => {
    const repository = new MemoryEventRepository();

    await expect(materializeDisclosureEvents(repository, 2)).resolves.toEqual({
      readCount: 3,
      createdCount: 3,
      updatedCount: 0,
    });
    expect([...repository.events.values()]).toMatchObject([
      { eventType: "SUPPLY_CONTRACT", visibility: "PUBLIC", ruleImportanceScore: 75 },
      { eventType: "OTHER", visibility: "REVIEW_REQUIRED", ruleImportanceScore: 20 },
      { eventType: "FUNDRAISING", visibility: "HIDDEN", ruleImportanceScore: 75 },
    ]);
  });

  it("is idempotent and updates events when materialized again", async () => {
    const repository = new MemoryEventRepository();
    await materializeDisclosureEvents(repository, 2);

    await expect(materializeDisclosureEvents(repository, 2)).resolves.toEqual({
      readCount: 3,
      createdCount: 0,
      updatedCount: 3,
    });
    expect(repository.events.size).toBe(3);
  });

  it("rejects unsafe batch sizes before reading data", async () => {
    const repository = new MemoryEventRepository();
    await expect(materializeDisclosureEvents(repository, 0)).rejects.toBeInstanceOf(RangeError);
  });
});

describe("decideEventVisibility", () => {
  it.each([
    ["ACTIVE", "SUPPLY_CONTRACT", "PUBLIC"],
    ["ACTIVE", "OTHER", "REVIEW_REQUIRED"],
    ["REVIEW_REQUIRED", "EARNINGS", "REVIEW_REQUIRED"],
    ["CORRECTED", "EARNINGS", "HIDDEN"],
    ["CANCELLED", "EARNINGS", "HIDDEN"],
  ] as const)("maps %s/%s to %s", (status, eventType, expected) => {
    expect(decideEventVisibility(status, eventType)).toBe(expected);
  });
});

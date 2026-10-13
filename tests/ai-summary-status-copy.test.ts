import {describe,expect,it} from "vitest";
import {AI_SUMMARY_STATUS_COPY as copy} from "@/domain/ai-summary-status-copy";
describe("clear AI generation guidance",()=>{
  it("separates source gaps, waiting, quota and outages without promising unavailable summaries",()=>{
    expect(copy.SOURCE_UNAVAILABLE.title).toContain("아직 자동 요약을 제공하지 못합니다");
    expect(copy.SOURCE_UNAVAILABLE.description).toContain("추측하지 않고");
    expect(copy.RATE_LIMIT.badge).toBe("생성 한도 대기");
    expect(copy.WAITING.description).toContain("약 2분");
    expect(copy.DELAYED.description).toContain("공시 자체에 문제가 있다는 뜻은 아닙니다");
  });
  it("does not advertise payment to bypass quota or fabricate completion percentages",()=>{
    const text=JSON.stringify(copy);expect(text).not.toContain("유료 결제");expect(text).not.toMatch(/\d+%/);expect(copy.RETRYING.description).toContain("완료 전에는 무료 체험");
  });
});

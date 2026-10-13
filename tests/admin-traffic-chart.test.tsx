import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {AdminTrafficChart} from "@/components/AdminTrafficChart";
import {buildAdminTrend} from "@/domain/admin-trend";
describe("real-data admin traffic chart",()=>{
  it("sorts actual dates and preserves missing values as gaps, not zero visits",()=>{
    const data=buildAdminTrend([{date:"2026-10-14",pageViews:15,uniqueIps:8},{date:"2026-10-13",pageViews:null,uniqueIps:3},{date:"invalid",pageViews:999,uniqueIps:999}]);
    expect(data.max).toBe(15);expect(data.points[0]?.date).toBe("2026-10-13");expect(data.points[0]?.pageY).toBeNull();expect(data.points[1]?.pageY).toBe(50);
  });
  it("keeps a measured zero as zero without NaN coordinates",()=>{
    const data=buildAdminTrend([{date:"2026-10-14",pageViews:0,uniqueIps:0}]);expect(data.points[0]?.pageY).toBe(230);expect(data.points[0]?.x).toBe(380);expect(JSON.stringify(data)).not.toContain("NaN");
  });
  it("renders only actual page/IP counts with keyboard and touch targets",()=>{
    const markup=renderToStaticMarkup(<AdminTrafficChart days={[{date:"2026-10-14",pageViews:15,uniqueIps:8}]} />);
    expect(markup).toContain("2026-10-14");expect(markup).toContain("페이지 조회 15");expect(markup).toContain("고유 접속 IP 8");expect(markup).toContain('aria-pressed="true"');expect(markup).toContain("<button");expect(markup).toContain("사람 수와 다릅니다");expect(markup).not.toContain("1,000");
  });
  it("does not invent a sample graph for an unconnected dataset",()=>{
    const markup=renderToStaticMarkup(<AdminTrafficChart days={[]} />);expect(markup).toContain("아직 표시할 방문 통계가 없습니다");expect(markup).not.toContain("<svg");expect(markup).not.toContain("0명");
  });
  it("handles invalid negative values as unknown",()=>{
    const data=buildAdminTrend([{date:"2026-10-14",pageViews:-3,uniqueIps:NaN}]);expect(data.points[0]?.pageY).toBeNull();expect(data.points[0]?.ipY).toBeNull();
  });
});

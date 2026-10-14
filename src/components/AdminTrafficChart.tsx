"use client";
import React,{useState} from "react";
import {buildAdminTrend,type TrendDatum} from "@/domain/admin-trend";
const number = (value:number|null) => value === null ? "조회 불가" : value.toLocaleString("ko-KR");
export function AdminTrafficChart({days}:Readonly<{days:readonly TrendDatum[]}>) {
  const chart = buildAdminTrend(days);
  const [selected,setSelected] = useState<string|null>(null);
  const current = chart.points.find(point=>point.date===selected) ?? chart.points.at(-1);
  if (!current) return <p className="admin-chart-empty" role="status">아직 표시할 방문 통계가 없습니다. 연결되면 실제 조회값으로 그래프를 표시합니다.</p>;
  const segments = (field:"pageY"|"ipY") => {
    const paths:string[]=[];let path="";
    for(const point of chart.points){
      const value=point[field];
      if(value===null){if(path)paths.push(path);path="";continue;}
      path+=`${path ? " L" : "M"}${point.x},${value}`;
    }
    if(path)paths.push(path);
    return paths;
  };
  return <section className="admin-traffic-chart" aria-labelledby="admin-traffic-chart-heading">
    <div className="admin-chart-heading"><h3 id="admin-traffic-chart-heading">최근 7일 방문·조회 추이</h3><p>그래프에 마우스를 올리거나 아래 날짜를 누르면 그날의 숫자가 보여요.</p></div>
    <div className="admin-chart-legend"><span className="admin-chart-page">● 페이지 조회</span><span className="admin-chart-ip">● 고유 접속 IP</span></div>
    <svg viewBox="0 0 760 280" className="admin-chart-svg" role="img" aria-label="날짜별 페이지 조회와 고유 접속 IP 추이 · 아래 날짜 버튼과 상세 표에서도 확인할 수 있습니다">
      {[0,.5,1].map(ratio=><g key={ratio}><line x1="56" x2="704" y1={230-ratio*180} y2={230-ratio*180} className="admin-chart-grid" /><text x="46" y={234-ratio*180} textAnchor="end" className="admin-chart-label">{Math.round(chart.max*ratio).toLocaleString("ko-KR")}</text></g>)}
      {segments("pageY").map((path,index)=><path key={`page${index}`} d={path} className="admin-chart-page-line" fill="none" strokeWidth="3" />)}
      {segments("ipY").map((path,index)=><path key={`ip${index}`} d={path} className="admin-chart-ip-line" fill="none" strokeWidth="3" />)}
      {chart.points.map(point=><g key={point.date}>
        <text x={point.x} y="263" textAnchor="middle" className="admin-chart-label">{point.date.slice(5).replace("-","/")}</text>
        {[{y:point.pageY,label:"페이지 조회",value:point.pageViews,className:"admin-chart-page-dot"},{y:point.ipY,label:"고유 접속 IP",value:point.uniqueIps,className:"admin-chart-ip-dot"}].map(series=>series.y===null ? null : <circle key={series.label} cx={point.x} cy={series.y} r={point.date===current.date ? 7 : 5} className={series.className}
          onMouseEnter={()=>setSelected(point.date)} onClick={()=>setSelected(point.date)}><title>{`${point.date} · ${series.label} ${number(series.value)}`}</title></circle>)}
      </g>)}
    </svg>
    <div className="admin-chart-dates" role="group" aria-label="날짜별 방문 통계 선택">{chart.points.map(point=><button type="button" key={point.date} aria-pressed={point.date===current.date} onClick={()=>setSelected(point.date)} onFocus={()=>setSelected(point.date)}
      aria-label={`${point.date} 페이지 조회 ${number(point.pageViews)}건, 고유 접속 IP ${number(point.uniqueIps)}개`}>{point.date.slice(5).replace("-","/")}</button>)}</div>
    <div className="admin-chart-selection" aria-live="polite"><time>{current.date} (UTC)</time><span>페이지 조회 <strong>{number(current.pageViews)}</strong>건</span><span>고유 접속 IP <strong>{number(current.uniqueIps)}</strong>개</span></div>
    <p className="admin-help">고유 접속 IP는 사람 수와 다릅니다. 같은 IP를 공유하는 사람·봇이 포함될 수 있으며, 현재 날짜의 집계는 진행 중입니다.</p>
  </section>;
}

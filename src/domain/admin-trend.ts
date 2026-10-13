export type TrendDatum = Readonly<{date:string;pageViews:number|null;uniqueIps:number|null}>;
export function buildAdminTrend(data:readonly TrendDatum[]) {
  const rows = data.filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date)).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const valid = (value:number|null) => value !== null && Number.isFinite(value) && value >= 0 ? value : null;
  const clean = rows.map(row=>({...row,pageViews:valid(row.pageViews),uniqueIps:valid(row.uniqueIps)}));
  const max = Math.max(1,...clean.flatMap(row=>[row.pageViews ?? 0,row.uniqueIps ?? 0]));
  const x = (index:number) => 56 + (clean.length>1 ? index/(clean.length-1) : .5)*648;
  const y = (value:number) => 230-(value/max)*180;
  return {max,points:clean.map((row,index)=>({...row,x:x(index),pageY:row.pageViews === null ? null : y(row.pageViews),ipY:row.uniqueIps === null ? null : y(row.uniqueIps)}))};
}

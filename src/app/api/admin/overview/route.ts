import { NextResponse } from "next/server";
import { readAdminAccess } from "@/server/admin-access";
import { readAdminDashboard } from "@/server/admin-dashboard";

export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store, max-age=0",Vary:"Cookie","X-Robots-Tag":"noindex, nofollow"};
export async function GET() {
  const access = await readAdminAccess();
  if (access !== "ADMIN") return NextResponse.json({error:"접근 권한이 없습니다."},{status:access==="SIGN_IN" ? 401 : 403,headers});
  try { return NextResponse.json(await readAdminDashboard(),{headers}); }
  catch { return NextResponse.json({error:"운영 통계를 불러오지 못했습니다."},{status:503,headers}); }
}

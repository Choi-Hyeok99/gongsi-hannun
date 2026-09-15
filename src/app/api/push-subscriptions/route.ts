import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.url().max(4096),
  keys: z.object({
    p256dh: z.string().min(20).max(512),
    auth: z.string().min(8).max(256),
  }),
});

const deleteSchema = z.object({ endpoint: z.url().max(4096) });

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json({ publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY ?? "" });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "올바르지 않은 알림 구독 정보입니다." }, { status: 400 });

  const { error } = await supabase.rpc("register_web_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_user_agent: request.headers.get("user-agent"),
  });
  if (error) return NextResponse.json({ error: "휴대폰 알림을 저장하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ enabled: true });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "올바르지 않은 알림 구독 정보입니다." }, { status: 400 });

  const { error } = await supabase.rpc("unregister_web_push_subscription", {
    p_endpoint: parsed.data.endpoint,
  });
  if (error) return NextResponse.json({ error: "휴대폰 알림을 해제하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ enabled: false });
}

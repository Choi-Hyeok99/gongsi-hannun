begin;

create table public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 4096),
  p256dh text not null check (char_length(p256dh) between 20 and 512),
  auth text not null check (char_length(auth) between 8 and 256),
  user_agent text check (user_agent is null or char_length(user_agent) <= 1000),
  minimum_importance_score smallint not null default 85 check (minimum_importance_score between 70 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  disabled_at timestamptz
);

create index web_push_subscriptions_user_enabled_idx
  on public.web_push_subscriptions (user_id, created_at desc)
  where disabled_at is null;

create table public.web_push_deliveries (
  notification_id uuid not null references public.in_app_notifications(id) on delete cascade,
  subscription_id uuid not null references public.web_push_subscriptions(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (notification_id, subscription_id)
);

create index web_push_deliveries_retry_idx
  on public.web_push_deliveries (status, updated_at)
  where status <> 'SENT';

create trigger web_push_subscriptions_set_updated_at
  before update on public.web_push_subscriptions
  for each row execute function public.set_updated_at();

create trigger web_push_deliveries_set_updated_at
  before update on public.web_push_deliveries
  for each row execute function public.set_updated_at();

alter table public.web_push_subscriptions enable row level security;
alter table public.web_push_subscriptions force row level security;
alter table public.web_push_deliveries enable row level security;
alter table public.web_push_deliveries force row level security;

revoke all on table public.web_push_subscriptions, public.web_push_deliveries
  from public, anon, authenticated;

grant select on table public.web_push_subscriptions to authenticated;
grant select, insert, update, delete on table public.web_push_subscriptions, public.web_push_deliveries
  to service_role;

create policy web_push_subscriptions_select_own
  on public.web_push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.register_web_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  subscription_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(p_endpoint) not between 20 and 4096
    or char_length(p_p256dh) not between 20 and 512
    or char_length(p_auth) not between 8 and 256 then
    raise exception 'Invalid web push subscription';
  end if;

  insert into public.web_push_subscriptions (
    user_id, endpoint, p256dh, auth, user_agent, disabled_at, failure_count
  ) values (
    current_user_id, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 1000), null, 0
  )
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    disabled_at = null,
    failure_count = 0
  returning id into subscription_id;

  return subscription_id;
end;
$$;

create or replace function public.unregister_web_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.web_push_subscriptions
  where user_id = auth.uid() and endpoint = p_endpoint;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke all on function public.register_web_push_subscription(text, text, text, text) from public;
revoke all on function public.unregister_web_push_subscription(text) from public;
grant execute on function public.register_web_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.unregister_web_push_subscription(text) to authenticated;

comment on table public.web_push_subscriptions is 'User-owned browser push subscriptions. Endpoint ownership is reassigned only through an authenticated RPC.';
comment on table public.web_push_deliveries is 'Idempotent delivery ledger for web push notifications.';

commit;

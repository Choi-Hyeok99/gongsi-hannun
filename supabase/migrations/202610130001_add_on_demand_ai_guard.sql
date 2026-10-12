-- Shared across Worker instances: one active call, ten-second spacing, 100 attempts/day.
-- No user, IP, browser or filing content is stored in this control table.
create table if not exists public.ai_on_demand_guard (
  id boolean primary key default true check (id),
  quota_day date not null,
  calls integer not null default 0 check (calls >= 0),
  lease_token uuid,
  lease_until timestamptz,
  next_allowed_at timestamptz not null default now(),
  blocked_until timestamptz
);
alter table public.ai_on_demand_guard enable row level security;
revoke all on table public.ai_on_demand_guard from public, anon, authenticated;
grant select, insert, update on table public.ai_on_demand_guard to service_role;

create or replace function public.acquire_on_demand_ai_slot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  slot public.ai_on_demand_guard%rowtype;
  instant timestamptz := clock_timestamp();
  day_key date := (instant at time zone 'America/Los_Angeles')::date;
  token uuid;
begin
  insert into public.ai_on_demand_guard(id, quota_day) values(true, day_key) on conflict(id) do nothing;
  select * into slot from public.ai_on_demand_guard where id = true for update;
  if slot.quota_day <> day_key then
    update public.ai_on_demand_guard set quota_day = day_key, calls = 0 where id = true;
    slot.calls := 0;
  end if;
  if slot.calls >= 100 then
    return jsonb_build_object('status', 'RATE_LIMIT');
  end if;
  if slot.blocked_until > instant then
    return jsonb_build_object('status', 'UNAVAILABLE');
  end if;
  if slot.lease_until > instant or slot.next_allowed_at > instant then
    return jsonb_build_object('status', 'BUSY', 'retryAfterSeconds', 10);
  end if;
  token := gen_random_uuid();
  update public.ai_on_demand_guard set calls = slot.calls + 1, lease_token = token,
    lease_until = instant + interval '90 seconds', next_allowed_at = instant + interval '10 seconds'
    where id = true;
  return jsonb_build_object('status', 'ACQUIRED', 'token', token);
end;
$$;

create or replace function public.release_on_demand_ai_slot(p_token uuid, p_error_code text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  instant timestamptz := clock_timestamp();
  block_until timestamptz;
begin
  if p_error_code in ('AI_RATE_LIMITED', 'AI_AUTH_ERROR', 'AI_BILLING_REQUIRED', 'AI_MODEL_NOT_FOUND', 'AI_INVALID_REQUEST') then
    block_until := (((instant at time zone 'America/Los_Angeles')::date + 1)::timestamp at time zone 'America/Los_Angeles');
  elsif p_error_code in ('AI_PROVIDER_UNAVAILABLE', 'AI_TIMEOUT', 'AI_UPSTREAM_ERROR') then
    block_until := instant + interval '1 minute';
  end if;
  update public.ai_on_demand_guard set lease_token = null, lease_until = null, blocked_until = block_until
    where id = true and lease_token = p_token;
end;
$$;
revoke all on function public.acquire_on_demand_ai_slot() from public, anon, authenticated;
revoke all on function public.release_on_demand_ai_slot(uuid, text) from public, anon, authenticated;
grant execute on function public.acquire_on_demand_ai_slot() to service_role;
grant execute on function public.release_on_demand_ai_slot(uuid, text) to service_role;

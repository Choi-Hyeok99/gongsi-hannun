begin;

create table public.user_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_type text not null check (policy_type in ('TERMS', 'PRIVACY')),
  version text not null check (char_length(version) between 1 and 50),
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_type, version)
);

create index user_consents_user_accepted_idx
  on public.user_consents (user_id, accepted_at desc);

alter table public.user_consents enable row level security;
alter table public.user_consents force row level security;

revoke all on table public.user_consents from public, anon, authenticated;
grant select, insert on table public.user_consents to authenticated;
grant select, insert, update, delete on table public.user_consents to service_role;

create policy user_consents_select_own
  on public.user_consents for select to authenticated
  using ((select auth.uid()) = user_id);

create policy user_consents_insert_own
  on public.user_consents for insert to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.record_signup_policy_consents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'terms_accepted_version' = '2026-09-26'
    and new.raw_user_meta_data ->> 'privacy_accepted_version' = '2026-09-26' then
    insert into public.user_consents (user_id, policy_type, version)
    values
      (new.id, 'TERMS', '2026-09-26'),
      (new.id, 'PRIVACY', '2026-09-26')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.record_signup_policy_consents() from public, anon, authenticated;
create trigger auth_user_created_policy_consents
  after insert on auth.users
  for each row execute function public.record_signup_policy_consents();

do $$
declare
  direct_cascade_count integer;
  delivery_cascade_count integer;
begin
  select count(*) into direct_cascade_count
  from pg_constraint
  where contype = 'f'
    and confrelid = 'auth.users'::regclass
    and confdeltype = 'c'
    and conrelid in (
      'public.profiles'::regclass,
      'public.watchlist_companies'::regclass,
      'public.watchlist_alert_settings'::regclass,
      'public.in_app_notifications'::regclass,
      'public.web_push_subscriptions'::regclass,
      'public.user_consents'::regclass
    );

  if direct_cascade_count <> 6 then
    raise exception 'Account deletion requires ON DELETE CASCADE for every user-owned table';
  end if;

  select count(*) into delivery_cascade_count
  from pg_constraint
  where contype = 'f'
    and conrelid = 'public.web_push_deliveries'::regclass
    and confdeltype = 'c'
    and confrelid in (
      'public.in_app_notifications'::regclass,
      'public.web_push_subscriptions'::regclass
    );

  if delivery_cascade_count <> 2 then
    raise exception 'Web push deliveries must cascade through notification and subscription ownership';
  end if;
end;
$$;

comment on table public.user_consents is
  'Versioned records of required policy acceptance. Authentication credentials remain in auth.users.';

commit;

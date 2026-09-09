begin;

create table public.watchlist_alert_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  enabled boolean not null default true,
  minimum_importance_score smallint not null default 60 check (minimum_importance_score between 0 and 100),
  event_types text[] not null default '{}'::text[] check (
    event_types <@ array[
      'SUPPLY_CONTRACT', 'INVESTMENT', 'FUNDRAISING', 'M_AND_A', 'EARNINGS',
      'CAPITAL_CHANGE', 'SHAREHOLDER_CHANGE', 'INSIDER_OWNERSHIP_CHANGE',
      'FACILITY_EXPANSION', 'NEW_BUSINESS', 'CLINICAL_RESULT', 'POLICY_SUPPORT',
      'MANAGEMENT_CHANGE', 'MATERIAL_DISCLOSURE', 'OTHER'
    ]::text[]
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, company_id),
  foreign key (user_id, company_id)
    references public.watchlist_companies(user_id, company_id)
    on delete cascade
);

create table public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  source_disclosure_id uuid not null references public.source_disclosures(id) on delete restrict,
  event_type text not null check (event_type in (
    'SUPPLY_CONTRACT', 'INVESTMENT', 'FUNDRAISING', 'M_AND_A', 'EARNINGS',
    'CAPITAL_CHANGE', 'SHAREHOLDER_CHANGE', 'INSIDER_OWNERSHIP_CHANGE',
    'FACILITY_EXPANSION', 'NEW_BUSINESS', 'CLINICAL_RESULT', 'POLICY_SUPPORT',
    'MANAGEMENT_CHANGE', 'MATERIAL_DISCLOSURE', 'OTHER'
  )),
  importance_score smallint not null check (importance_score between 0 and 100),
  classification_version text not null check (char_length(classification_version) between 1 and 50),
  title text not null check (char_length(title) between 1 and 500),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, source_disclosure_id),
  constraint notification_read_order check (read_at is null or read_at >= created_at)
);

create index watchlist_alert_settings_company_idx
  on public.watchlist_alert_settings (company_id)
  where enabled;

create index in_app_notifications_user_created_idx
  on public.in_app_notifications (user_id, created_at desc);

create index in_app_notifications_user_unread_idx
  on public.in_app_notifications (user_id, created_at desc)
  where read_at is null;

create trigger watchlist_alert_settings_set_updated_at
  before update on public.watchlist_alert_settings
  for each row execute function public.set_updated_at();

alter table public.watchlist_alert_settings enable row level security;
alter table public.in_app_notifications enable row level security;
alter table public.watchlist_alert_settings force row level security;
alter table public.in_app_notifications force row level security;

revoke all on table public.watchlist_alert_settings, public.in_app_notifications
  from public, anon, authenticated;

grant select, insert, delete on table public.watchlist_alert_settings to authenticated;
grant update (enabled, minimum_importance_score, event_types)
  on table public.watchlist_alert_settings to authenticated;
grant select on table public.in_app_notifications to authenticated;
grant update (read_at) on table public.in_app_notifications to authenticated;

grant select, insert, update, delete
  on table public.watchlist_alert_settings, public.in_app_notifications
  to service_role;

create policy watchlist_alert_settings_select_own
  on public.watchlist_alert_settings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy watchlist_alert_settings_insert_own
  on public.watchlist_alert_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy watchlist_alert_settings_update_own
  on public.watchlist_alert_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy watchlist_alert_settings_delete_own
  on public.watchlist_alert_settings for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy in_app_notifications_select_own
  on public.in_app_notifications for select to authenticated
  using ((select auth.uid()) = user_id);

create policy in_app_notifications_update_own
  on public.in_app_notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.watchlist_alert_settings is 'Per-user important disclosure settings restricted to the user watchlist.';
comment on table public.in_app_notifications is 'Idempotent in-app alerts. External email and push delivery are intentionally out of scope.';

commit;

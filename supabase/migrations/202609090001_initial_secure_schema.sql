begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
revoke create on schema public from public;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  dart_corp_code varchar(8) not null unique check (dart_corp_code ~ '^[0-9]{8}$'),
  stock_code varchar(6) unique check (stock_code is null or stock_code ~ '^[0-9]{6}$'),
  name_ko text not null check (char_length(name_ko) between 1 and 200),
  name_en text check (name_en is null or char_length(name_en) <= 300),
  market text not null check (market in ('KOSPI', 'KOSDAQ', 'KONEX', 'OTHER')),
  sector text check (sector is null or char_length(sector) <= 100),
  is_listed boolean not null default true,
  is_active boolean not null default true,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint active_listed_company_has_stock_code check (not (is_active and is_listed) or stock_code is not null)
);

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('COMPANY_SYNC', 'DISCLOSURE_COLLECT', 'AI_ANALYZE')),
  status text not null check (status in ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED')),
  range_start timestamptz,
  range_end timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  read_count integer not null default 0 check (read_count >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  error_code text check (error_code is null or char_length(error_code) <= 100),
  error_message text check (error_message is null or char_length(error_message) <= 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  constraint ingestion_run_finish_state check (
    (status = 'RUNNING' and finished_at is null)
    or (status <> 'RUNNING' and finished_at is not null)
  ),
  constraint ingestion_run_range_order check (range_end is null or range_start is null or range_end >= range_start)
);

create table public.source_disclosures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  ingestion_run_id uuid references public.ingestion_runs(id) on delete set null,
  source text not null default 'OPENDART' check (source = 'OPENDART'),
  receipt_no varchar(14) not null check (receipt_no ~ '^[0-9]{14}$'),
  report_name text not null check (char_length(report_name) between 1 and 500),
  filer_name text check (filer_name is null or char_length(filer_name) <= 200),
  disclosed_on date not null,
  received_at timestamptz,
  original_url text not null check (original_url ~ '^https://'),
  raw_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_metadata) = 'object'),
  disclosure_status text not null default 'ACTIVE' check (disclosure_status in ('ACTIVE', 'CORRECTED', 'CANCELLED', 'REVIEW_REQUIRED')),
  corrects_disclosure_id uuid references public.source_disclosures(id) on delete set null,
  correction_kind text check (correction_kind is null or correction_kind in ('CORRECTION', 'CANCELLATION', 'WITHDRAWAL')),
  content_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, receipt_no),
  constraint disclosure_not_self_correcting check (corrects_disclosure_id is null or corrects_disclosure_id <> id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  source_disclosure_id uuid not null unique references public.source_disclosures(id) on delete restrict,
  event_type text not null check (event_type in ('SUPPLY_CONTRACT','INVESTMENT','FUNDRAISING','M_AND_A','EARNINGS','CAPITAL_CHANGE','SHAREHOLDER_CHANGE','INSIDER_OWNERSHIP_CHANGE','FACILITY_EXPANSION','NEW_BUSINESS','CLINICAL_RESULT','POLICY_SUPPORT','MANAGEMENT_CHANGE','MATERIAL_DISCLOSURE','OTHER')),
  title text not null check (char_length(title) between 1 and 500),
  occurred_on date not null,
  occurred_on_basis text not null check (occurred_on_basis in ('SOURCE_DATE', 'DISCLOSED_ON')),
  published_at timestamptz,
  facts jsonb not null default '{}'::jsonb check (jsonb_typeof(facts) = 'object'),
  rule_importance_score smallint not null check (rule_importance_score between 0 and 100),
  importance_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(importance_reasons) = 'array'),
  importance_version text not null check (char_length(importance_version) between 1 and 50),
  visibility text not null default 'REVIEW_REQUIRED' check (visibility in ('PUBLIC', 'HIDDEN', 'REVIEW_REQUIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  analysis_version text not null check (char_length(analysis_version) between 1 and 50),
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
  model_provider text check (model_provider is null or char_length(model_provider) <= 100),
  model_name text check (model_name is null or char_length(model_name) <= 100),
  plain_summary text check (plain_summary is null or char_length(plain_summary) <= 2000),
  why_it_matters text check (why_it_matters is null or char_length(why_it_matters) <= 4000),
  checkpoints jsonb not null default '[]'::jsonb check (jsonb_typeof(checkpoints) = 'array'),
  cautions jsonb not null default '[]'::jsonb check (jsonb_typeof(cautions) = 'array'),
  extracted_facts jsonb not null default '[]'::jsonb check (jsonb_typeof(extracted_facts) = 'array'),
  ai_importance_score smallint check (ai_importance_score is null or ai_importance_score between 0 and 100),
  input_hash text not null check (char_length(input_hash) between 32 and 128),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 20),
  locked_at timestamptz,
  lease_expires_at timestamptz,
  error_code text check (error_code is null or char_length(error_code) <= 100),
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, analysis_version),
  constraint analysis_success_fields check (
    status <> 'SUCCEEDED'
    or (generated_at is not null and model_provider is not null and model_name is not null and plain_summary is not null)
  ),
  constraint analysis_lease_order check (lease_expires_at is null or locked_at is null or lease_expires_at > locked_at)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text check (nickname is null or char_length(nickname) between 2 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_nickname_unique_ci
  on public.profiles (lower(nickname))
  where nickname is not null;

create table public.watchlist_companies (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create index companies_active_market_name_idx on public.companies (market, name_ko, id) where is_active and is_listed;
create index ingestion_runs_job_started_idx on public.ingestion_runs (job_type, started_at desc);
create index ingestion_runs_success_idx on public.ingestion_runs (job_type, finished_at desc) where status = 'SUCCEEDED';
create index source_disclosures_company_date_idx on public.source_disclosures (company_id, disclosed_on desc, receipt_no desc);
create index source_disclosures_date_idx on public.source_disclosures (disclosed_on desc, receipt_no desc);
create index events_public_daily_idx on public.events (occurred_on desc, rule_importance_score desc, id desc) where visibility = 'PUBLIC';
create index events_public_company_idx on public.events (company_id, occurred_on desc, id desc) where visibility = 'PUBLIC';
create index events_type_date_idx on public.events (event_type, occurred_on desc);
create index ai_analyses_pending_idx on public.ai_analyses (status, created_at) where status in ('PENDING', 'FAILED');
create index watchlist_companies_user_created_idx on public.watchlist_companies (user_id, created_at desc);
create index watchlist_companies_company_idx on public.watchlist_companies (company_id);

create trigger companies_set_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger source_disclosures_set_updated_at before update on public.source_disclosures for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger ai_analyses_set_updated_at before update on public.ai_analyses for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
create trigger auth_user_created_profile after insert on auth.users for each row execute function public.create_profile_for_new_user();

alter table public.companies enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.source_disclosures enable row level security;
alter table public.events enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.profiles enable row level security;
alter table public.watchlist_companies enable row level security;

alter table public.companies force row level security;
alter table public.ingestion_runs force row level security;
alter table public.source_disclosures force row level security;
alter table public.events force row level security;
alter table public.ai_analyses force row level security;
alter table public.profiles force row level security;
alter table public.watchlist_companies force row level security;

revoke all on table public.companies, public.ingestion_runs, public.source_disclosures, public.events, public.ai_analyses, public.profiles, public.watchlist_companies from public, anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.companies, public.ingestion_runs, public.source_disclosures, public.events, public.ai_analyses, public.profiles, public.watchlist_companies to service_role;

grant select (user_id, nickname, created_at, updated_at) on public.profiles to authenticated;
grant update (nickname) on public.profiles to authenticated;
grant select (user_id, company_id, created_at), insert (user_id, company_id), delete on public.watchlist_companies to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy watchlist_select_own on public.watchlist_companies for select to authenticated using ((select auth.uid()) = user_id);
create policy watchlist_insert_own on public.watchlist_companies for insert to authenticated with check ((select auth.uid()) = user_id);
create policy watchlist_delete_own on public.watchlist_companies for delete to authenticated using ((select auth.uid()) = user_id);

comment on table public.profiles is 'Minimal public profile linked to Supabase Auth; credentials and email remain in auth.users.';
comment on table public.watchlist_companies is 'User-owned saved companies protected by row-level security.';
comment on table public.ingestion_runs is 'Server-only operational metadata; never store secrets or raw credentials.';
comment on column public.source_disclosures.raw_metadata is 'Allow-listed source metadata only; no secrets or unnecessary personal data.';
comment on column public.ai_analyses.extracted_facts is 'Validated structured output only; do not store prompts, tokens, credentials, or personal data.';

commit;

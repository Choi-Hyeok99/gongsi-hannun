begin;

alter table public.companies
  add column if not exists industry_code varchar(6),
  add column if not exists industry_profile_attempted_at timestamptz,
  add column if not exists industry_profile_synced_at timestamptz,
  add column if not exists industry_profile_error_code varchar(100);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_industry_code_check'
      and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_industry_code_check
      check (industry_code is null or industry_code ~ '^[0-9]{2,6}$');
  end if;
end
$$;

alter table public.ingestion_runs
  drop constraint if exists ingestion_runs_job_type_check;

alter table public.ingestion_runs
  add constraint ingestion_runs_job_type_check check (
    job_type in ('COMPANY_SYNC', 'COMPANY_INDUSTRY_SYNC', 'DISCLOSURE_COLLECT', 'AI_ANALYZE')
  );

create index if not exists companies_pending_industry_sync_idx
  on public.companies (id)
  where is_active and is_listed and industry_profile_synced_at is null;

comment on column public.companies.industry_code is
  'Industry code returned by the OpenDART company overview API.';
comment on column public.companies.industry_profile_synced_at is
  'Successful company overview lookup time; non-null also records an official no-data response.';
comment on column public.companies.industry_profile_error_code is
  'Sanitized machine-readable last failure code only; never contains credentials or response bodies.';

commit;

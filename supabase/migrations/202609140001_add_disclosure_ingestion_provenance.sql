begin;

create table public.disclosure_ingestion_observations (
  ingestion_run_id uuid not null references public.ingestion_runs(id) on delete cascade,
  source_disclosure_id uuid not null references public.source_disclosures(id) on delete cascade,
  observed_at timestamptz not null,
  primary key (ingestion_run_id, source_disclosure_id)
);

create index disclosure_ingestion_observations_disclosure_idx
  on public.disclosure_ingestion_observations (source_disclosure_id, observed_at desc);

alter table public.disclosure_ingestion_observations enable row level security;
alter table public.disclosure_ingestion_observations force row level security;

revoke all on table public.disclosure_ingestion_observations from public, anon, authenticated;
grant select, insert, update, delete on table public.disclosure_ingestion_observations to service_role;

comment on table public.disclosure_ingestion_observations is
  'Server-only record of every disclosure observed by each collection run for completeness audits.';
comment on column public.source_disclosures.ingestion_run_id is
  'Most recent ingestion run that observed this disclosure. Full history is retained in disclosure_ingestion_observations.';
comment on column public.source_disclosures.received_at is
  'Most recent time the application observed this disclosure from OpenDART; not the filer submission time.';

commit;

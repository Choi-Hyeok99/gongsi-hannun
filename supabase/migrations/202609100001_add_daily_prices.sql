begin;

alter table public.ingestion_runs
  drop constraint ingestion_runs_job_type_check;

alter table public.ingestion_runs
  add constraint ingestion_runs_job_type_check
  check (job_type in ('COMPANY_SYNC', 'DISCLOSURE_COLLECT', 'AI_ANALYZE', 'DAILY_PRICE_SYNC'));

create table public.daily_prices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  ingestion_run_id uuid references public.ingestion_runs(id) on delete set null,
  source text not null check (source ~ '^[A-Z0-9_]{2,30}$'),
  trading_date date not null,
  currency char(3) not null default 'KRW' check (currency = 'KRW'),
  open_price numeric(20, 4) not null check (open_price > 0),
  high_price numeric(20, 4) not null check (high_price > 0),
  low_price numeric(20, 4) not null check (low_price > 0),
  close_price numeric(20, 4) not null check (close_price > 0),
  volume numeric(24, 0) not null check (volume >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, source, trading_date),
  constraint daily_price_range_valid check (
    high_price >= greatest(open_price, low_price, close_price)
    and low_price <= least(open_price, high_price, close_price)
  )
);

create index daily_prices_company_date_idx
  on public.daily_prices (company_id, trading_date desc, source);

create trigger daily_prices_set_updated_at
  before update on public.daily_prices
  for each row execute function public.set_updated_at();

alter table public.daily_prices enable row level security;
alter table public.daily_prices force row level security;

revoke all on table public.daily_prices from public, anon, authenticated;
grant select, insert, update, delete on table public.daily_prices to service_role;

comment on table public.daily_prices is 'Server-owned end-of-day OHLCV data; providers are replaceable through the source field.';
comment on column public.daily_prices.source is 'Non-secret provider identifier only. Never store API keys or raw credentials.';

commit;

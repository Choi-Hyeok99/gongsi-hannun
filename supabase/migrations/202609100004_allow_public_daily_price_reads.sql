begin;

revoke insert, update, delete, truncate, references, trigger
  on table public.daily_prices
  from anon, authenticated;

grant select
  on table public.daily_prices
  to anon, authenticated;

drop policy if exists daily_prices_public_read on public.daily_prices;

create policy daily_prices_public_read
  on public.daily_prices
  for select
  to anon, authenticated
  using (true);

comment on policy daily_prices_public_read on public.daily_prices is
  'End-of-day market prices are publicly readable; all writes remain service-role only.';

commit;

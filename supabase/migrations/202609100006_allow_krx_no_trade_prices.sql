begin;

alter table public.daily_prices
  drop constraint daily_prices_open_price_check,
  drop constraint daily_prices_high_price_check,
  drop constraint daily_prices_low_price_check,
  drop constraint daily_price_range_valid;

alter table public.daily_prices
  add constraint daily_prices_open_price_check check (open_price >= 0),
  add constraint daily_prices_high_price_check check (high_price >= 0),
  add constraint daily_prices_low_price_check check (low_price >= 0),
  add constraint daily_price_range_valid check (
    (
      volume = 0
      and open_price = 0
      and high_price = 0
      and low_price = 0
    )
    or (
      open_price > 0
      and high_price >= greatest(open_price, low_price, close_price)
      and low_price > 0
      and low_price <= least(open_price, high_price, close_price)
    )
  );

comment on constraint daily_price_range_valid on public.daily_prices is
  'Allows the official KRX no-trade representation (zero volume and zero intraday OHLC) while preserving a positive close.';

commit;

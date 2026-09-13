# KRX Daily Price Sync

The collector imports end-of-day OHLCV data from the official KRX Open API into
`public.daily_prices`. It calls the KOSPI, KOSDAQ, and KONEX daily trading APIs
once per weekday and filters the returned market rows to active listed companies.

## Prerequisites

1. Obtain a KRX Open API authentication key.
2. Apply for and receive approval for all three services:
   - `stk_bydd_trd` (KOSPI)
   - `ksq_bydd_trd` (KOSDAQ)
   - `knx_bydd_trd` (KONEX)
3. Add `KRX_API_KEY` to `.env.local`. Never commit its value.
4. Apply all Supabase migrations, including the KRX no-trade price constraint.

KRX requires the key in the `AUTH_KEY` request header. Each API receives one
`basDd=YYYYMMDD` query parameter. An authentication or unapproved-service response
is reported as `AUTHENTICATION_FAILED` in `ingestion_runs` without exposing the key.

## Run

The default command backfills the latest 31 calendar days in Korea Standard Time:

```shell
pnpm sync:daily-prices
```

Use an explicit range when repairing a known period:

```shell
pnpm sync:daily-prices -- --from 2026-08-11 --to 2026-09-10
```

The inclusive range cannot exceed 31 calendar days. Saturdays and Sundays are not
requested; official empty responses on exchange holidays are treated as successful
no-data days. Re-running the same range updates the existing `(company, source,
trading_date)` rows and creates a new operational `ingestion_runs` record.

## Publication requirement

The KRX Open API terms require a screen built from its results to identify that it
uses “KRX statistical information.” They also restrict providing received data to
third parties. Confirm that the approved purpose covers the intended public product
before production launch and retain visible source attribution on price screens.

Official references:

- <https://openapi.krx.co.kr/contents/OPP/INFO/OPPINFO003.jsp>
- <https://openapi.krx.co.kr/contents/OPP/INFO/OPPINFO002.jsp>
- <https://openapi.krx.co.kr/contents/OPP/INFO/service/OPPINFO004.cmd>

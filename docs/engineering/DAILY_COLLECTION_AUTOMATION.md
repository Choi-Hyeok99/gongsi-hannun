# Daily collection automation

The low-cost MVP pipeline runs as one GitHub Actions workflow. It preserves the
modular-monolith boundary and does not add a separate server or queue.

## Schedule and order

The workflow runs on weekdays at 07:10 UTC (16:10 Korea Standard Time) and again
at 09:20 UTC (18:20 Korea Standard Time). The first run follows KRX's preliminary
16:00 end-of-day transmission; the second follows the 18:10 final transmission
and repairs late corrections. It can also be started manually with an optional
KST date.

1. Collect OpenDART disclosures for the collection date and the prior calendar day.
2. Materialize disclosure events and their rule-based importance scores.
3. Create idempotent in-app alerts for both dates from each user's watchlist settings.
4. Re-collect the latest seven calendar days of KRX closing prices.

The one-day disclosure overlap catches filings published after the previous run. The
seven-day price lookback repairs a missed workflow run and crosses ordinary weekends
without leaving the displayed close stale. Database uniqueness constraints and upserts
make both retries safe. A workflow concurrency group prevents overlapping runs, and any
failed step stops the remaining steps.

## Required GitHub Actions secrets

Configure these only in the repository's Actions secrets. Never put their values in
tracked files, workflow YAML, issue text, or logs.

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `OPENDART_API_KEY`
- `KRX_API_KEY`

The workflow uses read-only repository permissions. Secret values are passed as
process environment variables and are not printed by the collection commands.

## Operations

- Scheduled workflows run from the repository's default branch, so this workflow
  becomes active only after it reaches that branch.
- A manual run is useful for a missed business day or deployment verification.
- Holidays may return no KRX rows; the collector treats that as a valid no-trade day,
  while the lookback keeps the latest prior trading day available.
- Keep daily closing prices until a licensed real-time feed is ready. At that point,
  replace only the market-data collection step and retain the same persistence model.

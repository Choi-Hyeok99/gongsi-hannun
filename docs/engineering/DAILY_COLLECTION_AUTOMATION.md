# Daily collection automation

The low-cost MVP pipeline runs as one GitHub Actions workflow. It preserves the
modular-monolith boundary and does not add a separate server or queue.

## Schedule and order

The workflow runs on weekdays at 09:30 UTC (18:30 Korea Standard Time) and can
also be started manually with an optional KST date.

1. Collect OpenDART disclosures for the collection date and the prior calendar day.
2. Materialize disclosure events and their rule-based importance scores.
3. Create idempotent in-app alerts for both dates from each user's watchlist settings.
4. Collect the collection date's KRX closing prices.

The one-day overlap catches disclosures published after the previous run. Database
uniqueness constraints and upserts make retries safe. A workflow concurrency group
prevents overlapping runs, and any failed step stops the remaining steps.

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
- Holidays may return no KRX rows; the collector treats that as a valid no-trade day.
- Keep daily closing prices until a licensed real-time feed is ready. At that point,
  replace only the market-data collection step and retain the same persistence model.

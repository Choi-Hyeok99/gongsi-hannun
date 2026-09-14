# Live data activation

Use this sequence before enabling the Korean beta. It separates schema and
credential verification from jobs that write production-like data.

## 1. Apply migrations

Apply every SQL file in `supabase/migrations` by filename order. The initial
migration is already recorded as complete, but later migrations add daily prices,
alerts, filing documents, industry data, and disclosure ingestion provenance.
Re-run the read-only RLS checks in `SUPABASE_SETUP.md` after applying them.

## 2. Configure GitHub Actions secrets

Add these repository Actions secrets. Never paste their values into issues, pull
requests, workflow inputs, or logs.

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `OPENDART_API_KEY`
- `KRX_API_KEY`
- `GEMINI_API_KEY` (optional until AI summaries are enabled)

The market-price collector uses the KRX Open API, not the Korea Investment &
Securities API. Approve `stk_bydd_trd`, `ksq_bydd_trd`, and `knx_bydd_trd` for the
same KRX key.

## 3. Run the non-writing readiness check

Run the manual **Verify live data readiness** workflow with `require_data=false`.
It checks required migration columns, secret formats, Supabase access, OpenDART
authentication, and all three KRX service approvals. It never prints secret values.

For local verification:

```shell
pnpm verify:live-data
```

## 4. Perform the initial collection

Run these jobs in order after the readiness check passes:

1. `pnpm sync:companies`
2. `pnpm sync:company-industries`
3. `pnpm sync:disclosures`
4. `pnpm materialize:events`
5. `pnpm sync:daily-prices`

Then run **Verify live data readiness** again with `require_data=true`. Empty
companies, disclosures, or daily prices fail the second check.

## 5. Enable schedules only after verification

GitHub scheduled workflows run only from the repository default branch. Merging a
workflow into `develop` does not activate its schedule. Promote it only after the
manual run succeeds and the KRX public-display purpose has been approved. This is
independent of Cloudflare deployment; keeping Worker deployment disabled does not
prevent GitHub data-collection workflows from running.

# OpenDART company synchronization

## Status

- ZIP download, XML parsing, response size limits, ZIP expansion limits, listed-company filtering, idempotent upsert, and ingestion-run logging are implemented.
- A real run is blocked only by the local `OPENDART_API_KEY`.
- The OpenDART corporation-code file does not include market or sector. New rows are therefore stored as `OTHER` with no sector instead of guessing.

## Run

Put the 40-character OpenDART key in the ignored `.env.local` file:

```dotenv
OPENDART_API_KEY=
```

Then run:

```shell
pnpm sync:companies
```

Never paste the key into chat, source code, logs, SQL, or a tracked file.

## Follow-up

1. Verify the first-run company count and sample well-known stock codes.
2. Add an approved market-classification source for KOSPI, KOSDAQ, and KONEX.
3. Add a reviewed delisting/deactivation policy before automatically marking existing rows inactive.
4. Schedule the job only after staging smoke tests and failure alerts pass.

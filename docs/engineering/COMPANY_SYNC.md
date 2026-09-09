# OpenDART company synchronization

## Status

- ZIP download, XML parsing, response size limits, ZIP expansion limits, listed-company filtering, idempotent upsert, and ingestion-run logging are implemented.
- The local OpenDART key is configured in the ignored `.env.local` file.
- The OpenDART corporation-code file does not include market or sector. New rows are therefore stored as `OTHER` with no sector instead of guessing.

## Run log

| Date (KST) | Source rows | Listed companies created | Updated | Failed | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-09-09 | 119,039 | 3,931 | 0 | 0 | Succeeded |

Sample verification passed for Samsung Electronics, SK hynix, NAVER, and Kakao by stock code.

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

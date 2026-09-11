# Cloudflare Workers deployment

The Next.js application is packaged for Cloudflare Workers with the OpenNext adapter and deployed with Wrangler.

## Prerequisites

- Node.js 20 or later
- pnpm 11
- A Cloudflare account with Workers enabled
- Wrangler authentication through `pnpm wrangler login` for local deployment, or `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in CI

## Environment configuration

Copy `.env.example` to `.dev.vars` for local Workers previews and fill in the required values. Never commit `.dev.vars` or production secrets.

Configure public build variables such as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` in Cloudflare Workers Builds. Add server-only values such as `SUPABASE_SECRET_KEY`, `OPENDART_API_KEY`, `KRX_API_KEY`, `CRON_SECRET`, and `GEMINI_API_KEY` as encrypted Worker secrets.

For example:

```sh
pnpm wrangler secret put SUPABASE_SECRET_KEY
pnpm wrangler secret put OPENDART_API_KEY
```

## Verify locally

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm cf-typegen
pnpm exec opennextjs-cloudflare build
```

Run `pnpm preview` to build and serve the application in the local Workers runtime.

The `Cloudflare build` GitHub Actions workflow repeats the checks on Linux for pull requests and manual runs. It also performs a Wrangler dry-run without publishing the Worker.

## Deploy

```sh
pnpm deploy
```

`wrangler.jsonc` is the source of truth for the Worker name, compatibility date, runtime flags, asset binding, and observability. Update the compatibility date deliberately and run the verification commands before deploying the change.

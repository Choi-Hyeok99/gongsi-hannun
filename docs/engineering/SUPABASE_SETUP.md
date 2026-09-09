# Supabase setup

## Current status

- [x] Create the development project in the Seoul region.
- [x] Copy the project URLs, publishable key, and secret key to `.env.local`.
- [x] Apply `supabase/migrations/202609090001_initial_secure_schema.sql`.
- [x] Run the post-migration verification queries below.

Never commit `.env.local`, access tokens, database passwords, or service-role keys.

## Required local variables

Create `.env.local` from `.env.example` and fill these values from the Supabase project settings:

- `NEXT_PUBLIC_SUPABASE_URL`: project URL used by browser clients.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: safe for browser use with Row Level Security enabled.
- `SUPABASE_URL`: project URL used by server-only modules.
- `SUPABASE_SECRET_KEY`: server-only secret; never use in client components.

Keep `SUPABASE_ACCESS_TOKEN`, the database password, and the project reference outside tracked files. They are deployment or CLI credentials, not application runtime variables. Use the current `sb_publishable_...` and `sb_secret_...` keys rather than the legacy `anon` and `service_role` keys.

## Apply the migration

For the first development setup, open the Supabase SQL editor, paste the entire migration file, and run it once. Do not paste any secret into the SQL editor.

Migration file:

`supabase/migrations/202609090001_initial_secure_schema.sql`

## Verification

Run these read-only checks in the SQL editor after the migration succeeds:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

All application tables must report `rowsecurity = true`. Confirm that profile and watchlist policies only allow the authenticated user to access their own rows.

## Setup log

| Date (KST) | Result | Note |
| --- | --- | --- |
| 2026-09-09 | Prepared | Environment variable contract and migration verification steps recorded. Project creation and migration application require Supabase account access. |
| 2026-09-09 | Updated | Environment variable contract migrated to Supabase publishable and secret API keys. |
| 2026-09-09 | Completed | Development project connected. Migration succeeded with 7 public tables, RLS enabled on all 7 tables, and 5 policies. |

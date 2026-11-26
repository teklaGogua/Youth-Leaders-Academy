# Supabase setup and connection

Use separate Supabase projects for development/demo and production. Never use production for the first migration test.

## 1. Project and authentication settings

1. Open the Supabase dashboard and select the Youth Leaders Academy development/demo project.
2. Save the database password in a password manager. It is not an application environment variable.
3. In **Authentication → Providers → Email**, enable email/password sign-in and keep email confirmation enabled.
4. Require at least 8 characters for passwords, matching the current registration design.
5. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:5173`.
6. Add the local callback and recovery URLs: `http://localhost:5173/auth/callback` and `http://localhost:5173/reset-password`.
7. Add exact HTTPS URLs for the deployed frontend; do not use a wildcard redirect in production.

## 2. Connect the frontend

Copy `.env.example` to `.env`, then set the project URL and public publishable/anon key. Never put `service_role`, `sb_secret_...`, a database password or another secret in a Vite variable. Never commit `.env`.

## 3. Apply and test migrations locally

Install Docker Desktop and the Supabase CLI, then run:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

`db reset` recreates the local database, applies all migrations and loads the synthetic seed data. It is destructive to the local database only. Do not run it against a hosted project.

## 4. Hosted demo SQL

The migration `202611270001_competition_application_submission.sql` has not been applied to the hosted project. The single script `supabase/scripts/phase6_hosted_demo.sql` contains the migration function/grants and creates one synthetic published competition.

1. Open the intended **development/demo** Supabase project.
2. Verify its project reference in the dashboard before running any SQL.
3. Open **SQL Editor**, create a new query and paste the complete contents of `supabase/scripts/phase6_hosted_demo.sql`.
4. Review the SQL, then run it once. It is safe to re-run: the function is replaced and the synthetic competition is upserted by its unique slug.
5. Confirm the RPC privileges:

```sql
select
  has_function_privilege('anon', 'public.submit_competition_application(uuid,jsonb)', 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', 'public.submit_competition_application(uuid,jsonb)', 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', 'public.submit_competition_application(uuid,jsonb)', 'EXECUTE') as service_role_can_execute;
```

Expected result: `false, true, false`. The script creates no Auth users. Register a dedicated synthetic test account through the normal application flow to test it. Never add real participant data to the demo competition.

To use the supported migration CLI workflow instead, link the verified development project and inspect `supabase migration list` and `supabase db push --dry-run` before confirming a push. Do not modify previously applied migrations or manually edit the migration history table.

## 5. Production email and owner checks

Custom SMTP (Brevo proposed) remains a deployment task. Authenticate the sending domain, configure SPF/DKIM/DMARC, verify the sender and keep SMTP credentials in Supabase secrets/settings. Test Georgian confirmation and recovery templates, expired links and rate limits using dedicated accounts.

Hosted migration execution, real-account RLS isolation and email delivery are not verified by local CI. Keep production separate and do not use impersonated JWT claims in the SQL Editor.

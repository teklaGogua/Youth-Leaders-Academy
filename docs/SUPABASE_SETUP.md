# Supabase setup and connection

Use separate Supabase projects for development and production. Never use production for the first migration test.

## 1. Project and authentication settings

1. Select the Youth Leaders Academy development project.
2. Keep the database password in a password manager; it is not a frontend environment variable.
3. In **Authentication → Providers → Email**, enable email/password sign-in and email confirmation.
4. Require at least 8 characters for passwords.
5. Set the local Site URL to `http://localhost:5173`.
6. Add `http://localhost:5173/auth/callback` and `http://localhost:5173/reset-password` as allowed redirect URLs.
7. Add the exact HTTPS callback and recovery URLs for the deployed frontend.

## 2. Connect the frontend

Copy `.env.example` to `.env`, then set the project URL and public anon/publishable key. Never put service-role keys, secret keys or database passwords in Vite variables. Never commit `.env`.

## 3. Apply and test migrations locally

Install Docker Desktop and the Supabase CLI, then run:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

`db reset` recreates the local database, applies all migrations and loads synthetic local seed data. It is destructive to the local database only. Do not run it against a hosted project.

## 4. Hosted migration boundary

The Phase 6 migration `202611270001_participant_profile_onboarding.sql` has not been applied to hosted Supabase. It now defines `public.save_participant_profile(jsonb,boolean)`, a secure participant-owned profile persistence function. It does not create competitions, applications, demo users or synthetic competition data.

Before applying it to a hosted development project:

1. Verify the Supabase project reference in the dashboard.
2. Inspect `supabase migration list` and compare the remote history with the three previously applied migrations.
3. Review `supabase db push --dry-run` output and confirm that only the new Phase 6 migration is pending.
4. Apply through the approved migration workflow. Never modify previously applied migrations or manually edit the migration history table.
5. Verify RPC grants and test onboarding using dedicated synthetic accounts.

Hosted migration execution, real-account RLS isolation and email delivery are owner-operated checks. Never use impersonated JWT claims in the SQL Editor and never test with real participant information.

## 5. Production email

Configure custom SMTP only after the sending domain is authenticated. Set SPF/DKIM/DMARC, verify the sender, store credentials in Supabase secrets/settings, and test Georgian confirmation and recovery templates, expired links and rate limits.

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

## 5. Parent email verification service

The parent/guardian address is verified separately from Supabase Auth. No parent Auth user is created. The Edge Function stores only a SHA-256 token hash; the raw 256-bit token is sent in an email, expires after 30 minutes, is single-use, and is rate-limited to three sends per account per hour.

This implementation sends parent verification through Resend's HTTPS API, not SMTP. Create and verify a sending domain in Resend, publish the SPF and DKIM DNS records it supplies, and configure DMARC for the domain. Verify the sender address before deploying.

Set these Edge Function secrets (never Vite variables):

```bash
npx supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxx \
  RESEND_FROM_EMAIL="Youth Leaders Academy <verify@your-verified-domain.ge>" \
  APP_URL=https://your-production-domain.ge
npx supabase functions deploy parent-email-verification
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Do not copy them into source code or expose the service-role key to the browser. Configure the exact production app origin in `APP_URL`; it is also used for CORS and verification links.

## 6. Supabase Auth confirmation SMTP

For production participant-account confirmation and password recovery, configure a dedicated SMTP provider in **Supabase Dashboard → Project Settings → Authentication → SMTP Settings** (the dashboard label may appear under Authentication settings):

1. Enable custom SMTP.
2. Enter the provider's SMTP hostname.
3. Use port **465 with SSL** or **587 with STARTTLS**, according to the provider.
4. Enter the SMTP username and password issued by the provider.
5. Set the sender name to **Youth Leaders Academy** and sender address to a verified address on your domain.
6. Save, then use **Authentication → Users** to test signup and password recovery with a synthetic mailbox.
7. Verify SPF, DKIM and DMARC for the sender domain. Keep SMTP credentials only in the Supabase dashboard, never in GitHub or frontend environment variables.
8. In **Authentication → URL Configuration**, set the production Site URL and allow the exact `https://your-production-domain.ge/auth/callback` and `https://your-production-domain.ge/reset-password` URLs. Keep the local URLs for local development only.

Use the production provider's exact host, credentials and verified sender; these values are account-specific and must not be guessed.

## 7. Approved Terms and Privacy documents

Registration completion intentionally fails closed until the organization supplies and approves both documents. No legal wording is invented in this repository. After legal/organizational approval, insert the exact text and version in the database as the owner, setting `is_published=true` for both `terms` and `privacy`. Example only—replace every placeholder with approved text and a real version before running:

```sql
insert into public.registration_documents(slug, version, title, content, is_published)
values
  ('terms', '<APPROVED_TERMS_VERSION>', 'წესები და პირობები', '<APPROVED_TERMS_TEXT>', true),
  ('privacy', '<APPROVED_PRIVACY_VERSION>', 'კონფიდენციალურობის პოლიტიკა', '<APPROVED_PRIVACY_TEXT>', true)
on conflict (slug) do update set
  version = excluded.version,
  title = excluded.title,
  content = excluded.content,
  is_published = excluded.is_published,
  updated_at = now();
```

Changing either published document version or text invalidates existing registration completion so participants must explicitly accept the new versions.

## 8. Hosted migration boundary

The earlier Phase 6 profile migration may already exist in hosted migration history. Do not reapply it or modify any applied migration. Compare the remote migration list with the repository first; apply only the new additive correction after reviewing the dry run. Hosted migration, Resend delivery, SMTP delivery, and actual cross-device email testing must be verified in the owner's Supabase project before public release.

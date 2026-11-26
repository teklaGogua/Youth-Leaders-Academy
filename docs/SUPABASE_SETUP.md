# Supabase setup and connection

Use separate Supabase projects for development and production. Never use production for the first migration test.

## 1. Project and authentication settings

1. Select the Youth Leaders Academy development project.
2. Keep the database password in a password manager; it is not a frontend environment variable.
3. In **Authentication → Providers → Email**, enable email/password sign-in and email confirmation.
4. Require at least 8 characters for passwords.
5. Set the local Site URL to `http://localhost:5173`.
6. Allow `http://localhost:5173/auth/callback` and `http://localhost:5173/reset-password` as redirect URLs.
7. Add the exact HTTPS callback and recovery URLs for the deployed frontend.
8. Use the SPA implicit callback flow configured in `src/lib/supabase.ts`. The shared auth provider subscribes to auth events and awaits `getSession()` so Supabase finishes processing the callback URL and restoring persisted storage before route guards run. Do not add a second manual code/token exchange in React.

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

## 4. Hosted migration reconciliation

The earlier `202611270001_participant_profile_onboarding.sql` may already be applied to hosted Supabase. The three original migrations are also immutable.

1. Verify the Supabase project reference in the dashboard.
2. Run `npx supabase migration list` and compare local and remote history.
3. If `202611270001_participant_profile_onboarding.sql` is already recorded remotely, do not apply it again.
4. Review `npx supabase db push --dry-run`. Confirm that the pending corrective migrations are `202611270002_enforce_verified_participant_registration.sql` and `202611270003_require_explicit_terms_acceptance.sql` (or only those not already recorded remotely).
5. Apply that additive correction through the approved deployment workflow. Never edit prior migration files or manually alter migration history.
6. Verify the new columns, function grants, RLS policies and Edge Function deployment in the intended development project before production. The 003 migration replaces the earlier completion RPC with one requiring explicit Terms and Privacy acceptance booleans as well as current document versions.

Hosted migration execution and live RLS checks are owner-operated tasks. Never use impersonated JWT claims in the SQL Editor and never test with real participant information.

## 5. Parent email verification service

The parent/guardian address is verified separately from Supabase Auth. No parent Auth user is created. The database stores only a SHA-256 token hash; the raw 256-bit token is sent only in the email URL fragment (never a query parameter), expires after 30 minutes, is single-use, and is rate-limited to three sends per participant per hour. The verification page removes the fragment from browser history immediately and redeems the token through the Edge Function. A changed parent email invalidates prior verification.

This implementation sends parent verification through Resend's HTTPS API, not SMTP. Create and verify a sending domain in Resend, publish the SPF and DKIM DNS records it supplies, and configure DMARC. Verify the sender address before deploying.

Set these Edge Function secrets (never Vite variables):

```bash
npx supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxx \
  RESEND_FROM_EMAIL="Youth Leaders Academy <verify@your-verified-domain.ge>" \
  APP_URL=https://your-production-domain.ge
npx supabase functions deploy parent-email-verification
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Do not copy them into source code or expose the service-role key to the browser. Set `APP_URL` to the exact production app origin; it is used for CORS and verification links. Local development should use the local app origin and a test Resend sender.

## 6. Supabase Auth confirmation SMTP

For production participant-account confirmation and password recovery, configure a dedicated SMTP provider in **Supabase Dashboard → Project Settings → Authentication → SMTP Settings** (the dashboard label may appear under Authentication settings):

1. Enable custom SMTP.
2. Enter the SMTP hostname supplied by your email provider.
3. Use port **465 with SSL** or **587 with STARTTLS**, according to the provider.
4. Enter the SMTP username and password issued by the provider.
5. Set the sender name to **Youth Leaders Academy** and sender address to a verified address on your domain.
6. Save, then test signup and password recovery using a synthetic mailbox.
7. Verify SPF, DKIM and DMARC for the sender domain. Keep SMTP credentials only in the Supabase dashboard, never in GitHub or frontend environment variables.
8. In **Authentication → URL Configuration**, set the production Site URL and allow the exact `https://your-production-domain.ge/auth/callback` and `https://your-production-domain.ge/reset-password` URLs. Keep local URLs for development only.
9. In **Authentication → Email Templates → Confirm signup**, retain Supabase's `{{ .ConfirmationURL }}` link (do not manually construct a callback URL or expose the OTP token). The app supplies `/auth/callback` as `emailRedirectTo`; the Supabase verify endpoint consumes the one-time email token and redirects with the session fragment. Test the link on first click and in a second browser/device. Expired or consumed links must fail clearly; the registration page provides a resend action.

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

Changing or removing a published document version/text invalidates existing registration completion so participants must explicitly accept the new versions. The final step displays an unchecked checkbox; the server records the acceptance timestamp and exact versions only after validating all prerequisites.

## 8. Scope and security

- Account registration and participant profile completion are separate from competition applications.
- Incomplete participants can browse public pages, resume registration and log out; direct participant-table and application reads are blocked until server completion.
- Participant writes go through the validated profile RPC. Parent verification tokens are not readable by clients.
- Administrators retain their role-based access without participant registration.
- Email ownership verification is not parental consent. No consent wording or eligibility rule is inferred.

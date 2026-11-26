# Supabase setup and connection

Use separate Supabase projects for development/demo and production. Do not use production for the first migration test. If the owner has already created a project, use that existing project rather than creating a duplicate.

## 1. Project and authentication settings

1. Open the Supabase dashboard and select the Youth Leaders Academy project.
2. Save the database password in a password manager. It is not an application environment variable.
3. In **Authentication → Providers → Email**, enable email/password sign-in and keep email confirmation enabled.
4. In the Auth password settings, require at least 8 characters as required by the current registration design. The local Supabase config applies the same minimum.
5. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:5173`.
6. Add these Redirect URLs:
   - `http://localhost:5173/auth/callback`
   - `http://localhost:5173/reset-password`
7. For a deployed frontend, add its exact HTTPS callback and reset-password URLs too. Do not use a wildcard redirect in production.

## 2. Connect the frontend

1. Open **Project Settings → API** (or **API Keys**, depending on the dashboard version).
2. Copy the **Project URL**.
3. Copy the public **publishable key**. If the project only exposes the legacy `anon` key, that public key is also supported.
4. In the repository root, copy `.env.example` to `.env`.
5. Set the two values:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
```

6. Restart `npm run dev` after changing `.env`.

Only the public publishable/anon key belongs in `VITE_` variables. Never use `service_role`, `sb_secret_...`, a database password or any other secret in the browser. Never commit `.env`.

Public information pages run without Supabase configuration. Login and registration remain disabled until both variables are supplied. The environment validator rejects a partially configured pair.

## 3. Apply migrations locally first

Install Docker Desktop and the Supabase CLI, then run from the repository root:

```bash
npx supabase start
npx supabase status
npx supabase db reset
npx supabase test db
```

`db reset` recreates the local database, applies all migrations and loads the synthetic `supabase/seed.sql` dataset. The local config targets PostgreSQL 17 to match the hosted project. Do not upgrade the remote database as part of this phase. `db reset` is destructive to the local database only. Never run it against production.

To use the remote development project after reviewing the target project reference:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Review the migration list, dry-run output and target project before confirming `db push`. Seed data is for local/demo use and is not applied by `db push`.

## Hosted project: read-only verification

Run these queries in Supabase SQL Editor. They inspect catalogs/counts only and do not change user data.

```sql
-- Tables and RLS flags
select n.nspname schema_name,c.relname table_name,c.relrowsecurity rls_enabled,c.relforcerowsecurity rls_forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname;
-- Policies
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname;
-- Table grants
select grantee,table_name,privilege_type from information_schema.table_privileges where table_schema='public' and grantee in ('anon','authenticated','service_role') order by table_name,grantee,privilege_type;
-- Column grants
select grantee,table_name,column_name,privilege_type from information_schema.column_privileges where table_schema='public' and grantee in ('anon','authenticated','service_role') order by table_name,column_name,grantee;
-- Triggers
select event_object_table,trigger_name,action_timing,event_manipulation,action_statement from information_schema.triggers where event_object_schema='public' order by event_object_table,trigger_name;
-- Functions
select p.oid::regprocedure,p.prosecdef,p.proconfig,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname;
-- privilege checks
select has_table_privilege('anon','public.profiles','SELECT') anon_profiles_select,has_column_privilege('authenticated','public.profiles','role','UPDATE') authenticated_role_update,has_column_privilege('authenticated','public.participants','user_id','UPDATE') participant_owner_update,has_function_privilege('anon','public.write_admin_audit_log()','EXECUTE') anon_audit_execute,has_function_privilege('authenticated','public.write_admin_audit_log()','EXECUTE') auth_audit_execute;
-- Data counts only
select 'participants' table_name,count(*) row_count from public.participants union all select 'applications',count(*) from public.applications union all select 'audit_logs',count(*) from public.audit_logs;
```

Catalog queries confirm policy/grant configuration, not live per-user isolation. Hosted RLS behavior is exercised in CI using synthetic users and rolled-back transactions. For hosted live testing, use a separate test project or dedicated accounts and authenticated sessions; do not impersonate JWTs in the production SQL editor or write test rows into production.

## Migration history reconciliation after manual application

The owner reports that all three migration SQL files were manually applied via hosted SQL Editor. The schema files remain the source of truth; manual SQL execution does not automatically register versions in CLI migration history.

Supabase officially supports `supabase migration repair` for reconciling history after verifying the schema is already applied. This adjusts migration tracking only; it does not execute migrations. CLI use is currently blocked by Windows security. Do not directly edit the history table or reapply migrations. Use an approved machine where the CLI is permitted, first confirm the linked project and migration list, and inspect `supabase migration repair --help` for installed version syntax.

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list --remote
# Only after confirming all 3 files' SQL is already applied:
supabase migration repair --status applied 202611260001 202611260002 202611260003 --remote
supabase migration list --remote
```

\n## 4. Frontend checks

```bash
npm ci
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
```

The normal frontend CI does not require Supabase credentials. Run `npx supabase test db` separately with the local Supabase stack for database/RLS checks.

## 5. Promote an administrator

Public signup always creates a participant. After the intended administrator has registered and their identity has been verified out of band, run the following in the Supabase SQL editor, replacing the email with the verified account:

```sql
update public.profiles
set role = 'administrator'
where id = (
  select id
  from auth.users
  where email = 'VERIFIED_ADMIN_EMAIL'
);
```

Confirm that exactly one row was updated. If zero rows were updated, confirm the account has registered and that the email matches. Never add role selection to the public registration form or frontend metadata.

## 6. Production email (proposed deployment task)\n\nSupabase default SMTP is for limited testing, subject to low send limits and HTTP 429 rate limiting, and should not be relied on for production delivery. Keep email confirmation enabled. Configure custom SMTP as a deployment task; Brevo is proposed, not configured. Authenticate a sending domain (SPF/DKIM and DMARC), verify sender identity, enter SMTP host/port/username/key in Supabase Auth settings, and keep secrets out of Git. Customize Georgian confirmation and recovery templates with allow-listed URLs. Configure/monitor rate limits and provider logs. Test signup confirmation, resend limits, password recovery, expired links and Georgian rendering using test accounts.\n\n## 7. Owner verification checklist

- [ ] Development/demo and production projects are separate.
- [ ] Email provider, confirmation and 8-character password policy settings are correct.
- [ ] Local and deployed callback/reset URLs are allow-listed.
- [ ] Local migration and RLS tests pass.
- [ ] Remote migration is applied to the intended development project.
- [ ] Frontend `.env` contains only the project URL and public key.
- [ ] A test participant can register, confirm email, log in and log out.
- [ ] A participant cannot read another participant's record or change their role/application status.
- [ ] Only the verified administrator can access `/admin` and protected database records.
- [ ] Password recovery email and reset flow work with the project's SMTP/email configuration.

## Verification status

This repository change has no access to the owner's Supabase project or credentials. Remote migrations, email delivery, production RLS and live authentication have not been verified. A successful frontend build or unit test is not proof of remote Supabase integration.

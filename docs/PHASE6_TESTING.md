# Phase 6 verification

## Automated checks

Run from the repository root:

```bash
npm ci
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install --with-deps chromium
npm run e2e
npx supabase start
npx supabase db reset
npx supabase test db
```

Vitest covers registration field validation, the four-step submission path, and participant-scoped dashboard loading. pgTAP covers authenticated ownership, participant-role enforcement, malformed and unexpected payloads, duplicate submissions, registration opening and closing times, direct-write denial, and application-status immutability. Playwright covers signed-out access to participant routes and responsive fail-closed rendering when Supabase is not configured.

## Manual participant flow

Use only the isolated demo Supabase project and the synthetic competition created by
`supabase/scripts/phase6_hosted_demo.sql`. Do not use real participant data.

1. Create a dedicated synthetic participant account through the normal signup page.
2. Confirm its email using the demo project's configured email provider, then sign in.
3. Open **კონკურსზე რეგისტრაცია** and confirm the four-step progress indicator and synthetic competition.
4. Complete personal information, education, and parent/guardian contact. Use a positive whole-number age and a biography of at most 500 characters. Parent email is optional.
5. Move back and forward between steps. Confirm values persist and Georgian validation messages appear for invalid input.
6. Review and submit once. Confirm the success screen shows the competition and application reference.
7. Open the participant dashboard. Confirm only this account's applications and profile information appear.
8. Try submitting the same competition again. The database must reject the duplicate without creating another application.
9. Sign out, sign in as a second synthetic participant, and confirm the first participant's details are not visible.
10. Check registration, confirmation, and dashboard at 320, 390, 768, 1024, and 1440 CSS pixels. Confirm no page-level horizontal overflow.

## Hosted and security boundary

The RPC uses the authenticated session's `auth.uid()`, verifies
`profiles.role = 'participant'`, validates payload fields server-side, locks the competition while checking published status and registration dates, and performs participant upsert plus application insert transactionally. The database unique constraint prevents duplicate participant/competition pairs. Participants have no direct application write policy.

CI runs PostgreSQL tests against a disposable local Supabase stack. It does not apply the migration to the hosted project. Run the hosted SQL script only in the intended isolated demo project after verifying its project reference. Production SMTP, live hosted RLS isolation, and organizational privacy/consent approval remain release gates.

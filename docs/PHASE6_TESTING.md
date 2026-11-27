# Phase 6 — authentication and participant registration verification

## Automated checks

Run from the repository root:

```bash
npm ci
npm run format
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

The dedicated CI authentication job starts a real local Supabase stack and runs `tests/auth-integration.spec.ts` against its Auth API and PostgreSQL database. It covers first-visit confirmation-link handling, persistent sessions across refresh/public routes, incomplete-account route gating and administrator access. pgTAP tests exercise database ownership, direct-table-write denial, registration completion, parent-token expiry/replay/email-change invalidation and accepted document versions. Vitest additionally covers persisted-session bootstrap without an auth event, stale initialization races, StrictMode provider resubscription, and the parent-email callback's single in-flight request under StrictMode. A separate real-Supabase Playwright job verifies the first-use signup confirmation callback, refresh and new-browser-context session restoration, direct REST write denial, incomplete-account route gating and administrator access. The PostgreSQL 17 pgTAP suite has 37 assertions for ownership, grants, completion prerequisites, terms versions, token expiry/replay/rate limits and changed parent addresses.

## Manual hosted testing

Use a dedicated hosted development project, a verified test sending domain and synthetic accounts only. Do not use real participant data.

1. **Account creation:** open `/register`. Step 1/4 must ask only for email, password and password confirmation. Create a synthetic account.
2. **Participant email confirmation:** open the confirmation email on the first attempt. The first click must establish the session and redirect directly to `/register?step=2` without an invalid-link flash. The callback must wait for Supabase URL processing and session restoration before deciding whether the link failed. Also test opening the link in a different browser/device. A consumed or expired link must show an actionable error; use the resend control to issue a new link.
3. **Session persistence:** after confirmation, navigate between `/`, `/competition`, `/about` and `/register`. The public header must show the authenticated account action, not the logged-out login/register buttons. Refresh, close/reopen the site in the same browser profile and navigate between public/protected pages; the session must restore and the public header must continue showing the authenticated account action. Explicit logout must clear the session and restore the logged-out header.
4. **Onboarding resume:** complete part of step 2/4, refresh, sign out and sign back in. Registration must resume at the first unfinished step. Repeat after step 3/4.
5. **Parent details:** enter mandatory parent/guardian name, phone and email on step 4/4. Save and request verification. Confirm that the email arrives at the parent mailbox without creating a parent Auth user.
6. **Parent token security:** verify once. The token is placed in the URL fragment, removed from browser history on arrival, and must not be sent to the server in the query string. Reopening the same link must fail. Change the parent email and confirm the old verification is invalidated. Request a new link and test expiry after 30 minutes. Send at most three requests within an hour; the next request must be rate-limited.
7. **Terms and Privacy:** before the organization publishes approved documents, the checkbox and links are visible but completion remains disabled. After approved versions are published, open both links and verify the exact text/version. Parent verification should reveal the final registration-completion panel within step 4/4. The checkbox starts unchecked; the completion button remains disabled until selected.
8. **Profile editing:** after completion, open the dashboard's profile-edit link. It must open step 2/4 in edit mode, preserve that mode while moving between steps and reviewing Terms/Privacy, and return to the dashboard only after the profile is revalidated and saved.
9. **Server enforcement:** while incomplete, open `/dashboard` and `/registration/confirmation` directly. Both must redirect to registration. Using the participant JWT, a direct SELECT from `participants` must return no rows; the guarded `get_participant_registration_profile` RPC must return only that user's draft. Direct INSERT/UPDATE to `participants`, direct UPDATE of `profiles.registration_completed_at`, and direct completion with false Terms/Privacy acceptance flags, missing parent verification or stale document versions must fail.
10. **Successful completion:** after participant email verification, parent email verification, all required profile fields and explicit Terms/Privacy acceptance, complete registration. Confirm `profiles.registration_completed_at` and the exact `registration_acceptances` versions/timestamp are stored. The participant dashboard must then load.
11. **Administrator:** sign in with an owner-provisioned administrator. Admin access must work without participant registration or parent verification.
12. **Responsive layout:** check 320, 390, 768, 1024 and 1440 CSS-pixel widths for clipped controls and page-level horizontal overflow.

## Hosted migration and configuration boundary

- Do not edit or reapply the three original migrations.
- The previously created `202611270001_participant_profile_onboarding.sql` may already be applied remotely. Inspect `supabase migration list`; never push it again if it is already recorded.
- Review and apply the additive corrective migrations `202611270002_enforce_verified_participant_registration.sql` and `202611270003_require_explicit_terms_acceptance.sql` only if each is pending in the remote migration history. Migration 003 replaces the completion RPC with one requiring both acceptance flags to be explicitly true.
- Deploy `supabase/functions/parent-email-verification` and configure its Resend secrets as documented in `docs/SUPABASE_SETUP.md`.
- Configure Supabase Auth custom SMTP for participant confirmation and recovery.
- The organization must provide legally approved Terms and Privacy text and versions before registration can complete. This repository deliberately contains no invented legal text. The server rejects completion while either published document is missing.
- Hosted migration execution, production email delivery, DNS authentication, and cross-device link behavior must be verified in the owner's project. Local CI cannot prove those hosted settings.

Email ownership verification is not parental consent. No parental consent or competition eligibility rules are implemented.

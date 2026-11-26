# Phase 6 verification — account registration and participant profile

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

Vitest covers profile validation, resumable multi-step onboarding, profile persistence and participant-scoped dashboard loading. PostgreSQL/pgTAP verifies authenticated participant ownership, partial and complete profile saves, server-side validation, role restrictions and anonymous RPC denial. Playwright verifies signed-out route protection and responsive rendering.

## Manual testing

Use a dedicated Supabase development project and synthetic accounts only.

1. Create an account at `/register` using email and password. Confirm that this step does not ask for competition selection or participant details.
2. If email verification is enabled, open the confirmation email and follow its link. Confirm that the callback creates a session and takes you to `/onboarding`.
3. Complete the personal-information step. Continue to education, then parent/guardian contact. Verify the progress indicator reads steps 2/4, 3/4 and 4/4 because credentials are step 1.
4. Navigate backward and forward. Refresh during onboarding and confirm previously saved fields are restored.
5. Submit invalid values (empty required fields, non-integer/zero age, malformed optional guardian email) and confirm Georgian validation errors appear without losing input.
6. Complete the final step. Confirm the registration-success page appears, then open the participant dashboard.
7. On the dashboard, verify the saved profile fields and the empty competition-applications state. Confirm the profile-edit action loads existing values and saves updates.
8. Sign out and sign in again. A completed profile must open the dashboard; an incomplete profile must resume at onboarding.
9. Create a second synthetic participant. Confirm that account cannot view or edit the first participant's profile.
10. Check 320, 390, 768, 1024 and 1440 CSS-pixel widths for clipped controls and page-level horizontal overflow.

## Security and hosted migration boundary

The new migration adds a SECURITY DEFINER profile-save RPC with an empty search path. It derives ownership exclusively from `auth.uid()`, checks the participant role, allowlists profile fields and validates types, lengths, age and optional guardian email. Partial saves enable resuming onboarding; the final save requires all profile fields. It creates or updates only the caller's participant row and never creates competition or application records.

The hosted Supabase migration has not been applied. Verify the target project and review the migration history before applying migrations through the normal deployment process. Never edit the three previously applied migrations or use production data for testing. No synthetic competition seed or hosted demo script is part of this phase.

No parental consent, eligibility or competition-specific rules are implemented.

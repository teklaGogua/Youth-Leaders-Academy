# Architecture — authentication and participant registration

## Authentication lifecycle

- One module-level Supabase client is created in `src/lib/supabase.ts` with session persistence and URL callback detection enabled.
- The SPA uses Supabase's implicit callback flow so confirmation links work when opened outside the browser that initiated signup; Supabase Auth owns URL token processing. The React callback route does not exchange the same code/token again.
- One `AuthProvider` subscribes to `onAuthStateChange` and independently awaits `getSession()` during bootstrap. A monotonic event revision prevents a slow initial storage read from overwriting a newer sign-in, token-refresh or sign-out event. It then loads the user's role and server-recorded completion timestamp. It does not issue competing URL exchanges from React effects.
- The provider remains mounted above the router. Public and protected layouts read the same context. The public header waits for initialization before rendering logged-out actions.
- Explicit logout calls Supabase Auth with local-session scope, waits for success, and clears the shared context so public and protected headers update together.
- Signup metadata cannot assign roles. New accounts receive the participant role through the existing auth trigger.

## Registration state and data model

- `auth.users.email_confirmed_at` is authoritative for participant account email verification.
- `public.profiles.registration_completed_at` is the server-controlled gate for normal participant access.
- `public.participants` stores personal, education and parent/guardian contact data independently of competition applications.
- `parent_contact_email_verified_at` is set only after a valid, unexpired, single-use parent token is redeemed by the trusted Edge Function.
- `public.parent_email_verification_tokens` stores token hashes, target email, expiry and consumption time. The raw token is delivered only in the email URL fragment, removed from browser history on callback, and sent to the Edge Function for redemption; it is never returned by the send API or placed in server query logs.
- `public.registration_documents` stores organization-approved Terms and Privacy versions. `public.registration_acceptances` stores the exact accepted versions and server timestamp.
- No parent Supabase Auth account is created. Email verification is not parental consent.

## Server enforcement

- Direct participant INSERT/UPDATE/DELETE grants are revoked from authenticated clients. Draft profile reads use `get_participant_registration_profile()`, which derives ownership from `auth.uid()`.
- Direct participant-table reads are restricted to completed participants and administrators. Application reads also require completed registration or administrator role.
- `save_participant_profile(jsonb,boolean)` is SECURITY DEFINER with an empty search path, validates allowlisted fields and requires a confirmed participant account. Its legacy completion flag is rejected.
- Parent-token creation and redemption are service-role-only database functions called by `parent-email-verification`. The Edge Function verifies the participant JWT before sending and uses Resend through HTTPS.
- `complete_participant_registration(text,text)` requires a confirmed participant email, all mandatory profile fields, matching verified parent email, and the currently published Terms and Privacy versions. It records acceptance and sets `registration_completed_at` in one transaction.
- Changing parent email clears its verification timestamp. Changing participant auth email resets completion until the new address is confirmed. Changing or removing published legal text resets registration completion for re-acceptance.
- Profiles, participant ownership, role protections and administrator routing remain separate. Administrators do not need participant registration.

## Legal and operational boundary

The repository intentionally does not invent Terms, Privacy language, parental consent or eligibility conditions. Registration completion stays disabled until the organization publishes approved document text and versions. Production also requires Supabase Auth SMTP and Resend sender-domain configuration. See `docs/SUPABASE_SETUP.md`.

## Migration safety

The three original migrations and the earlier profile-onboarding migration are immutable. The new correction is additive. Check remote migration history before applying it; never reapply a migration already recorded in hosted Supabase.

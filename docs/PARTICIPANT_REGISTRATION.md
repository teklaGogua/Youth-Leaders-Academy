# Participant registration, guardian verification and consent

## Four-step workflow

1. Personal information: first name, last name, age and biography.
2. Education: school, grade and teacher.
3. Parent/guardian: full name, phone and email. A guardian is mandatory for every participant, regardless of age. The guardian email is verified through a single-use email link.
4. Legal agreements: participant acceptance of the current Terms and Conditions and Privacy Policy. The same guardian email link is used to review and decide on those documents and the current guardian-consent declaration.

The participant can leave and resume. The first unfinished step is calculated from database state, not from frontend state or a URL parameter. The dashboard is available only after the server-side completion function succeeds. A guardian's Agree action submits the exact Terms, Privacy and guardian-consent versions rendered on that page. The database compares all three values with the current versions inside the decision transaction. If any version changed after page load, the decision is not recorded and the token remains unused; the page reloads the current documents so the guardian can review them and retry with the same link.

## Single-page navigation

Account creation and all four participant-registration stages use the stable `/registration` URL. The current stage is internal page state and is restored from the saved registration record after sign-in or email confirmation. The public navigation keeps `/login` and `/registration` as separate destinations; `/register` is retained only as a redirect to `/registration`. Incomplete participants are redirected to `/registration`, while participants with a server-recorded `completed_at` timestamp can access `/dashboard`.

## Security and persistence

Participant writes use the save_participant_registration_step RPC; finalization uses complete_participant_registration. Registration rows are readable only by their owner and administrators. Direct client insert/update/delete privileges are revoked. The database checks the previous step, validates required values, verifies current legal-document versions and rechecks all requirements during completion.

Guardian tokens contain 256 bits of cryptographic randomness. Only SHA-256 hashes are stored. Tokens are tied to the participant user ID, guardian email, action purpose and—when used for consent—the accepted Terms, Privacy and guardian-consent document versions. They expire after 30 minutes, are single-use, and previous outstanding links are invalidated when a new one is issued. Sending is rate-limited to three requests per user per 15 minutes.

Email verification sets only the guardian verification fields. It does not set parental consent. The one guardian email is issued after the participant saves valid guardian details. It contains one link for email verification and the guardian's explicit Agree or Reject decision. The guardian page displays the current Terms, Privacy and guardian-consent declaration. Agree submits the exact three versions displayed; the database stores those exact versions only if they are still current at decision time. Reject remains an explicit decision, consumes the link, and does not create consent. A stale-version response does not consume the link; the page refreshes the documents and allows the guardian to retry after reviewing them. A subsequent send is treated as already completed only when the guardian identity and all three stored consent versions match the current documents.

## Legal documents

The migrations insert current Terms, Privacy and guardian-consent declaration records explicitly marked as **organization placeholders, not approved legal wording**. The SQL test fixtures intentionally retain these placeholder versions so automated tests can exercise the workflow. The current database decision RPC checks that submitted versions are current, but it does not require approved_at; the UI labels unapproved documents as temporary placeholders. Therefore, the code and SQL fixtures do not themselves establish legal approval or enforce a production launch gate. The organization must explicitly decide and verify that all three Georgian-language documents have been approved before enabling production registration and guardian consent. This is an operational production prerequisite, not a claim that the test fixtures are approved. Publish a new version rather than overwriting an accepted version. A version change causes a stale guardian review to be rejected without consuming its token.

The organization must supply and approve:

- Terms and Conditions text and version.
- Privacy Policy text and version.
- Parent/guardian consent declaration text and version.
- Confirmation that the checkbox action and consent process match the organization's approved legal requirements.

No legal wording is invented by this implementation. The UI's affirmative checkbox is only an explicit action accepting the approved declaration shown above it.

## Production email configuration

Two email paths must be configured independently:

- **Supabase Auth emails** (signup confirmation, password recovery and email changes): in the Supabase Dashboard open Authentication → SMTP Settings, enable custom SMTP, and provide the SMTP host, port, username, password, sender email and sender name. Use a verified sender domain with SPF, DKIM and DMARC configured. Also set the production Site URL and exact allowed redirect URLs for the frontend auth callback and password-reset route. Do not commit SMTP credentials or put them in Vite variables. The local Supabase stack uses its local email catcher and does not prove production delivery.
- **Guardian verification and consent email**: the Edge Function uses Resend to send one message containing one link for email verification and the guardian decision. Configure a verified sending domain and SPF/DKIM/DMARC records, then set these Edge Function secrets (never Vite/browser variables):

  supabase secrets set RESEND_API_KEY=... GUARDIAN_VERIFICATION_FROM="Youth Leaders Academy <verify@example.org>" SITE_URL=https://your-frontend.example.org
  supabase functions deploy guardian-verification

Supabase supplies SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to deployed Edge Functions. The function has JWT verification disabled because guardian email links are opened without a participant session. Its send action independently validates the participant bearer JWT with Supabase Auth; the public verify and consent actions accept only single-use token hashes. Never expose the service-role key or Resend API key to the browser.

For local development, set the same three secrets after starting local Supabase and use a test Resend sender/domain. The frontend calls /functions/v1/guardian-verification. Configure the exact frontend URL in Supabase Auth redirect allow-lists.

## Operational requirements

- Apply all migrations to a local Supabase database first and run supabase test db.
- Deploy the Edge Function only after the migrations are applied.
- Configure Resend and verify the single guardian email, including both email verification and the explicit Agree/Reject decision.
- Replace all three legal placeholders before production registration is enabled.
- Test invalid, expired, reused, superseded and wrong-email tokens, and consent against outdated document versions.
- Never run local test migrations or seed data against production.

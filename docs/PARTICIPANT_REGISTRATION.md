# Participant registration, guardian verification and consent

## Four-step workflow

1. Personal information: first name, last name, age and biography.
2. Education: school, grade and teacher.
3. Parent/guardian: full name, phone and email. A guardian is mandatory for every participant, regardless of age. The guardian email is verified through a single-use email link.
4. Legal agreements: participant acceptance of the current Terms and Conditions and Privacy Policy, followed by a separate email request for explicit parent/guardian consent to those exact document versions.

The participant can leave and resume. The first unfinished step is calculated from database state, not from frontend state or a URL parameter. The dashboard is available only after the server-side completion function succeeds.

## Security and persistence

Participant writes use the save_participant_registration_step RPC; finalization uses complete_participant_registration. Registration rows are readable only by their owner and administrators. Direct client insert/update/delete privileges are revoked. The database checks the previous step, validates required values, verifies the current legal-document versions and rechecks all requirements during completion.

Guardian tokens contain 256 bits of cryptographic randomness. Only SHA-256 hashes are stored. Tokens are tied to the participant user ID, guardian email, action purpose and—when used for consent—the accepted Terms and Privacy versions. They expire after 30 minutes, are single-use, and previous outstanding links are invalidated when a new one is issued. Sending is rate-limited to three requests per user per 15 minutes.

Email verification sets only the guardian verification fields. It does not set parental consent. The consent email is issued only after the participant accepts the current approved legal documents. The guardian must review those documents and affirmatively check the separate consent control. The database stores the consent timestamp and the exact versions approved by the guardian.

## Legal documents

The first migration inserts current Terms and Privacy records explicitly marked as **organization placeholders, not approved legal wording**. Registration completion is blocked until the organization supplies approved Georgian-language text and sets approved_at on the current records. Publish a new version rather than overwriting an accepted version. Any legal-document publication invalidates unfinished participant and guardian acceptances so they must accept the new versions.

The organization must supply and approve:
- Terms and Conditions text and version.
- Privacy Policy text and version.
- Confirmation that the guardian-consent statement is legally approved.

No legal wording is invented by this implementation.

## Guardian email delivery deployment

The Edge Function uses Resend. Configure a verified sending domain and SPF/DKIM/DMARC records, then set these Edge Function secrets (never Vite/browser variables):

    supabase secrets set RESEND_API_KEY=... GUARDIAN_VERIFICATION_FROM="Youth Leaders Academy <verify@example.org>" SITE_URL=https://your-frontend.example.org
    supabase functions deploy guardian-verification

Supabase supplies SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to deployed Edge Functions. The function has JWT verification disabled because guardian email links are opened without a participant session. Its send action independently validates the participant bearer JWT with Supabase Auth; the public verify and consent actions accept only single-use token hashes. Never expose the service-role key or Resend API key to the browser.

For local development, set the same three secrets after starting local Supabase and use a test Resend sender/domain. The frontend calls /functions/v1/guardian-verification. Configure the exact frontend URL in Supabase Auth redirect allow-lists.

## Operational requirements

- Apply all migrations to a local Supabase database first and run supabase test db.
- Deploy the Edge Function only after the migrations are applied.
- Configure Resend and verify both guardian email verification and separate consent email delivery.
- Replace legal placeholders before production registration is enabled.
- Test invalid, expired, reused, superseded and wrong-email tokens, and consent against outdated document versions.
- Never run local test migrations or seed data against production.

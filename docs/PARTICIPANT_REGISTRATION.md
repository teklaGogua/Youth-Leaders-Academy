# Participant registration and guardian verification

## Workflow and security

Registration has four server-validated steps: personal information, education, parent/guardian contact, and legal agreements. Every participant must enter a parent/guardian, regardless of age. Saving is performed by \`save_participant_registration_step\`; completion is performed by \`complete_participant_registration\`. The browser cannot write registration rows directly. PostgreSQL RLS restricts reads to the participant and administrators.

Guardian email verification is a separate process from parental consent. The Edge Function creates a cryptographically random 256-bit token, stores only its SHA-256 hash, invalidates previous links, limits sends to three per 15 minutes, and expires links after 30 minutes. Verification is tied to the authenticated participant registration and exact guardian email. The database consumes each token once. Verifying an email address does not establish consent.

## Legal documents

The migration inserts two current documents marked in their title and content as **organization placeholders, not approved legal wording**. The organization must replace both with approved Georgian-language Terms and Conditions and Privacy Policy, increment their versions, and set \`approved_at\` before production. Accepted versions and timestamps are stored separately, together with the guardian contact and explicit parental-consent timestamp. The UI must display the placeholder warning while either current document is unapproved.

## Guardian email delivery deployment

The Edge Function uses Resend for transactional delivery. Configure a verified sending domain and SPF/DKIM/DMARC records in Resend, then set these Edge Function secrets (never Vite/browser variables):

\`\`\`sh
supabase secrets set RESEND_API_KEY=... GUARDIAN_VERIFICATION_FROM="Youth Leaders Academy <verify@example.org>" SITE_URL=https://your-frontend.example.org
supabase functions deploy guardian-verification
\`\`\`

Supabase supplies \`SUPABASE_URL\`, \`SUPABASE_ANON_KEY\` and \`SUPABASE_SERVICE_ROLE_KEY\` to deployed Edge Functions. The function is configured with JWT verification disabled because the guardian's email-link verification request is unauthenticated; its \`send\` action independently validates the participant's bearer JWT using Supabase Auth, while its \`verify\` action accepts only a single-use token hash lookup. Never expose the service-role key or Resend API key to the browser.

For local development, set the same three secrets with \`supabase secrets set\` after starting the local stack, and use a test Resend sender/domain. The frontend calls \`/functions/v1/guardian-verification\`. Configure the exact frontend URL in Supabase Auth redirect allow-lists as well.

## Operational requirements

- Apply the migration to a local Supabase database first and run \`supabase test db\`.
- Deploy the Edge Function only after the migration is applied.
- Configure Resend and verify a guardian can receive the message.
- Replace legal placeholders before production registration is enabled.
- Test invalid, expired, reused, superseded and wrong-email tokens.
- Never run local test migrations or seed data against production.

# Change manifest — Phase 4 & 5

## Added

- Supabase local configuration, initial schema migration, security-hardening migration, synthetic seed data and pgTAP tests.
- Typed database schema, authentication provider, Georgian auth pages and protected routes.
- Supabase setup and architecture documentation.
- Authentication validation and responsive Playwright coverage.

## Modified

- App routing, environment validation and typed Supabase client.
- README, project status, roadmap and agent guidance.

## Unchanged by design

- `package.json` and `package-lock.json`: required dependencies and scripts already exist.
- `.env.example`: already contains only empty public Supabase URL and anon-key placeholders.
- `.github/workflows/ci.yml`: read-only permissions and branch concurrency cancellation are preserved.

## Scope limits

No application submission UI, participant dashboard features, admin management screens, chatbot logic or payments are included. Participants cannot insert or change application rows through the browser client. A narrowly scoped transactional RPC is required in the next phase.

## Verification boundary

No claim is made that a Supabase migration, local RLS suite, live email flow or remote authentication has passed until the relevant command or service has actually been run.

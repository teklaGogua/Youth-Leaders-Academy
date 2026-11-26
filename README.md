# Youth Leaders Academy

Georgian-language platform for the Youth Leaders Academy, built with React 19, strict TypeScript, Vite, SCSS Modules, React Router, Supabase Auth, PostgreSQL and Zod.

## Setup

1. Install Node.js 22 and npm.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and add the Supabase Project URL and public publishable/anon key when available.
4. Run `npm run dev`.

Only the public Supabase URL and publishable/anon key belong in Vite variables. Never use a service-role key, secret key or database password in the browser. Never commit `.env`.

## Architecture

`src/app` contains routes and page-level views; `src/components` contains shared UI and layout primitives; `src/features/auth` contains authentication flows; `src/features/participant` contains the registration flow and participant dashboard; `src/lib` contains shared utilities and the typed Supabase client. Feature styles use SCSS Modules.

## Supabase

- Database schema and authorization model: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Setup, hosted SQL checks, migration reconciliation and production email: [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)
- Phase 6 hosted demo SQL: [supabase/scripts/phase6_hosted_demo.sql](supabase/scripts/phase6_hosted_demo.sql)
- SQL migrations: `supabase/migrations/`
- Synthetic local/demo seed data: `supabase/seed.sql`
- Local RLS regression tests: `supabase/tests/`

Public information pages work without Supabase credentials. Login and registration require both public environment variables.

## Scripts

- `npm run format` – format source files with Prettier
- `npm run format:check` – verify formatting without modifying files
- `npm run typecheck` – TypeScript check
- `npm run lint` – ESLint
- `npm run test` – Vitest unit tests
- `npm run build` – production build
- `npm run e2e` – Playwright end-to-end tests

Run `npx supabase start`, `npx supabase db reset` and `npx supabase test db` for local PostgreSQL/RLS tests. See the hosted-demo instructions before using the SQL script against a remote project.

## Phase 6 scope

Phase 6 adds the participant-owned competition application flow, a transactional Supabase submission RPC and the participant dashboard. The RPC validates the authenticated participant role, required field types and lengths, registration status and dates, and relies on the database unique constraint to reject duplicate applications. It does not accept caller-supplied ownership or application status. Parent/guardian consent and eligibility rules remain unimplemented pending organizational approval.

Administrator management, chatbot logic and payments are out of scope. Hosted migration execution and real-account verification are owner-operated tasks; never treat local CI as proof that the hosted project has been migrated.

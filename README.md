# Youth Leaders Academy

Georgian-language platform for the Youth Leaders Academy, built with React 19, strict TypeScript, Vite, SCSS Modules, React Router, Supabase Auth, PostgreSQL and Zod.

## Setup

1. Install Node.js 22 and npm.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and add the Supabase Project URL and public publishable/anon key when available.
4. Run `npm run dev`.

Only the public Supabase URL and publishable/anon key belong in Vite variables. Never use a service-role key, secret key or database password in the browser. Never commit `.env`.

## Architecture

`src/app` contains routes and page-level views; `src/components` contains shared UI and layout primitives; `src/features/auth` contains authentication flows; `src/features/participant` contains account onboarding and the participant dashboard; `src/lib` contains shared utilities and the typed Supabase client. Feature styles use SCSS Modules.

## Supabase

- Database schema and authorization model: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Setup and migration reconciliation: [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)
- SQL migrations: `supabase/migrations/`
- Synthetic local seed data: `supabase/seed.sql`
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

Run `npx supabase start`, `npx supabase db reset` and `npx supabase test db` for local PostgreSQL/RLS tests.

## Phase 6 scope

Phase 6 implements account credentials, email verification, resumable four-step participant onboarding, participant profile persistence/editing and a participant-owned dashboard. Participant data is stored independently of competition applications. The dashboard displays an empty-state placeholder for future competition applications; no application submission, payment, eligibility, consent or administrator workflow is included.

The profile RPC derives ownership from the authenticated session and validates profile data server-side. Hosted migration execution and real-account verification are owner-operated tasks; never treat local CI as proof that the hosted project has been migrated.

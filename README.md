# Youth Leaders Academy

Georgian-language platform for the Youth Leaders Academy, built with React 19, strict TypeScript, Vite, SCSS Modules, React Router, Supabase Auth, PostgreSQL and Zod.

## Setup

1. Install Node.js 22 and npm.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and add the Supabase Project URL and public publishable/anon key when available.
4. Run `npm run dev`.

Only the public Supabase URL and publishable/anon key belong in Vite variables. Never use a service-role key, secret key or database password in the browser. Never commit `.env`.

## Architecture

`src/app` contains routes and page-level views; `src/components` contains shared UI and layout primitives; `src/features/auth` contains authentication flows; `src/lib` contains shared utilities and the typed Supabase client; `src/styles` contains global styles and design tokens. Feature styles use SCSS Modules.

## Supabase

- Database schema and authorization model: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Setup, hosted SQL checks, migration reconciliation and production email: [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)
- SQL migrations: `supabase/migrations/`
- Participant onboarding, guardian verification and consent deployment: docs/PARTICIPANT_REGISTRATION.md
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
- `npx supabase test db` – local database/RLS tests (requires Docker and Supabase CLI)

## Scope

The current implementation includes public information pages, authentication, a four-step participant registration workflow, guardian email verification, versioned legal-document acceptance, explicit guardian consent, a participant dashboard and role-based route protection. Competition application submission, administrator management screens, chatbot logic and payments remain future work. Application submission is intentionally blocked at the database policy level until a narrow transactional RPC is implemented.

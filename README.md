# Youth Leaders Academy

Frontend foundation for the Georgian Youth Leaders Academy platform. Business modules are intentionally not implemented yet.

## Stack

React 19 · TypeScript (strict) · Vite · SCSS Modules · React Router · Supabase · Zod · Vitest · Playwright.

## Setup

1. Install Node.js (current LTS) and npm.
2. `npm install`
3. Copy `.env.example` to `.env` and add Supabase values when available.
4. `npm run dev`

## Scripts

- `npm run build` – production build and TS project build
- `npm run typecheck` – TypeScript check
- `npm run lint` – ESLint
- `npm run test` – Vitest
- `npm run e2e` – Playwright

## Architecture

`src/app` routes and page-level views; `src/components/ui` reusable UI primitives; `src/features` feature modules (reserved); `src/lib` shared utilities and service clients; `src/styles` global styles and design tokens. Page styles use SCSS Modules.

## Environment

Only public Supabase URL and anon key belong in the browser environment. Never commit secrets. Supabase RLS and server-side policy design are required before data features are built.

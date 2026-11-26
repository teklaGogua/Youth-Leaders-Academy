# Project agent guidance

## Technology and architecture

- Keep strict TypeScript; avoid `any`, suppressions and non-null assertions unless justified.
- Use React, TypeScript and SCSS Modules. Do not add Tailwind.
- Preserve existing routing and project configuration unless a change is required.
- Keep business functionality out until explicitly requested.
- Keep secrets out of source; use `.env.example` placeholders.

## Design and content

- Follow approved Figma frames, design tokens, assets and responsive layouts.
- Use Noto Sans Georgian and preserve the official academy emblem.
- Use Georgian for user-facing content.
- Do not invent competition rules, dates, fees, eligibility, contact details, privacy terms or other official information.
- Clearly label information that has not been confirmed by the organization.

## Security

- Treat React route guards as navigation UX only; enforce authorization with PostgreSQL grants and RLS.
- Public signup must never assign an administrator role.
- Never expose Supabase service-role/secret keys or database passwords in browser code or Vite environment variables.
- Do not add direct participant application writes; use an approved transactional database function.
- Do not weaken RLS policies to make frontend tests pass.

## Accessibility and responsive behavior

- Favor semantic HTML, accessible controls, visible focus, labels and keyboard navigation.
- Keep touch targets at least 44px where practical.
- Verify responsive layouts at 320px, 390px, 768px, 1024px and 1440px.

## Readability and maintainability

- Source code must remain human-readable; production build minification is acceptable, source minification is not.
- Use descriptive variable, function, component and file names.
- Format JSX across multiple lines and separate imports, types, constants, component logic and returned markup.
- Keep functions focused and avoid nested ternaries, compressed expressions and clever one-line implementations.
- Add concise comments only for non-obvious logic and architectural decisions.
- Write SCSS declarations on separate lines, use centralized design tokens and avoid excessive nesting.
- Use Prettier with printWidth 100, tabWidth 2, useTabs false, semi true, singleQuote true and trailingComma all.
- Run `npm run format` before committing and `npm run format:check` in CI.
- Run typecheck, lint, unit tests, build and `npm audit` before reporting completion.

## Git workflow

- Work on the approved feature branch and create one draft pull request targeting `main`.
- Batch related changes into one logical commit when Git Trees are available; target one to three commits per phase.
- If the GitHub integration does not expose the base tree SHA required for a multi-file tree commit, individual-file commits are authorized; minimize their number and keep changes grouped logically.
- Never use a ZIP as the delivery method when GitHub write access is available.
- Verify the complete changeset before publishing.
- Never force-push, rewrite existing history, or merge into the base branch without explicit owner approval.
- Keep CI workflows read-only; verify formatting instead of committing source changes.
- Preserve branch-based CI concurrency cancellation.

# Project status

## Completed before Phase 4 & 5
- Georgian public homepage, competition information, about and FAQ pages.
- Shared public layout, responsive navigation, design tokens, official emblem component and self-hosted Noto Sans Georgian.
- CI quality workflow with read-only permissions and branch-scoped concurrency cancellation.

## Phase 4 & 5 implementation in this branch
- Initial PostgreSQL schema for profiles, participants, competitions, applications, FAQ entries and audit logs.
- Explicit table grants and RLS policies for anonymous, participant and administrator access.
- Server-side profile creation and default participant role assignment on signup.
- Typed Supabase client and optional environment configuration with partial-configuration validation.
- Georgian login, registration, logout, session restoration, email confirmation callback, password recovery and reset.
- Participant and administrator route guards; PostgreSQL RLS remains the authorization boundary.
- Synthetic local/demo seed data and local pgTAP RLS regression tests.
- Supabase setup and architecture documentation.

## Not verified in this branch yet
- GitHub Actions results for the Phase 4 & 5 changes.
- Local npm checks if a clean dependency install is unavailable in the execution environment.
- Local Supabase migration and pgTAP execution.
- Remote Supabase configuration, remote migration, email delivery and live authentication.
- Figma pixel comparison at all responsive breakpoints. Login, registration and their state frames were inspected (`19:598`, `19:694`, `19:847`, `19:952`). The implementation follows the desktop split-panel structure and Georgian copy; the photo area remains the explicit Figma placeholder pending an approved academy photo.

## Owner decisions
- Confirm participant age/eligibility requirements, parent-contact fields and privacy/consent wording before implementing application submission.
- Confirm application status vocabulary and workflow.
- Provision administrator accounts out of band; public signup cannot choose an administrator role.

## Next phase
Implement the approved competition registration workflow through a transactional database function, then build the participant dashboard and approved administrator workflows. Do not add direct participant application writes to the browser client.

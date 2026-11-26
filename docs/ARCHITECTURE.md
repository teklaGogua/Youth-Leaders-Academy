# Architecture — database and authentication foundation

## Runtime boundaries

- The browser uses only the Supabase project URL and public anon/publishable key.
- Supabase Auth manages passwords and sessions. The application never stores passwords in its own tables.
- Public signup creates a `profiles` row with the `participant` role. The signup trigger may copy the supplied `full_name` into the profile; participant application details are collected separately and never control authorization.
- React route guards control navigation only. PostgreSQL grants and row-level security (RLS) are the authorization boundary.
- The service-role key and database password must never be added to Vite variables or browser code.

## Data model

- `auth.users` has a one-to-one relationship with `public.profiles`.
- `public.profiles` has a one-to-zero-or-one relationship with `public.participants`.
- A participant can have multiple `public.applications`; each application belongs to one competition.
- `(participant_id, competition_id)` is unique, preventing duplicate applications to the same competition.
- `public.faq_entries` stores published and unpublished FAQ content.
- `public.audit_logs` stores minimal administrative change metadata, never row contents, credentials or tokens.

Participant parent-contact columns, eligibility rules, age requirements and consent requirements are provisional. Confirm them with the organization before implementing the application form. Competition statuses (`draft`, `published`, `archived`) and application statuses (`registered`, `pending`, `approved`, `rejected`) are schema states; confirm the business workflow with the organization before exposing it.

## Authorization matrix

| Resource     | Anonymous      | Participant                   | Administrator                                |
| ------------ | -------------- | ----------------------------- | -------------------------------------------- |
| Profiles     | No access      | Read own; update display name | Read all; role changes are owner-provisioned |
| Participants | No access      | Read/insert/update own record | Read/update/delete records                   |
| Competitions | Read published | Read published                | Full management                              |
| Applications | No access      | Read own; no direct writes    | Full management                              |
| FAQ entries  | Read published | Read published                | Full management                              |
| Audit logs   | No access      | No access                     | Read only                                    |

Application creation is intentionally unavailable to participant browser sessions in this phase; the `applications_admin_manage` policy is administrator-only. The next phase should add a narrowly scoped transactional RPC after the registration workflow is approved. Participants must never choose or change application status.

## Database security

- RLS is enabled on every application table.
- The profile creation trigger assigns the participant role server-side and ignores role-related signup metadata.
- The `is_administrator()` check is a `SECURITY DEFINER` function with an empty `search_path` and fully qualified table references. It is safe to call for anonymous users and returns only a boolean.
- The browser has no `UPDATE` grant on `profiles.role`. A database trigger also rejects role changes from client sessions, including administrator sessions; trusted owner provisioning is performed through the SQL editor.
- Audit triggers write table/action/record identifiers only. They never copy personal row data or authentication secrets.
- Audit rows are not writable through the public client.

## Administrator provisioning

Do not expose an administrator signup route. Create the user through normal signup, verify their identity through a trusted channel, then promote the account from the Supabase SQL editor using the procedure in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

## Verification boundary

The repository contains versioned local migrations, synthetic seed data and pgTAP database-security regression tests. These files are not proof that a remote Supabase project has been configured or migrated. Verify them against a local Supabase stack before connecting production. Live email delivery, remote RLS behavior and administrator access remain unverified until the owner configures and tests a project.

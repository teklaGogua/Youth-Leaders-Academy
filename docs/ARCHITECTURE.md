# Architecture — authentication, registration and database security

## Runtime boundaries

- The browser uses only the Supabase project URL and public anon/publishable key.
- Supabase Auth manages passwords and sessions. The application never stores passwords in its own tables.
- Public signup creates a `profiles` row with the `participant` role. Signup metadata cannot set authorization roles.
- React route guards control navigation only. PostgreSQL grants, row-level security (RLS) and the submission RPC are the authorization boundary.
- The service-role key and database password must never be added to Vite variables or browser code.

## Data model

- `auth.users` has a one-to-one relationship with `public.profiles`.
- `public.profiles` has a one-to-zero-or-one relationship with `public.participants`.
- A participant can have multiple `public.applications`; each application belongs to one competition.
- `(participant_id, competition_id)` is unique, preventing duplicate applications to the same competition.
- `public.audit_logs` stores minimal administrative change metadata, never row contents, credentials or tokens.

## Authorization

| Resource | Anonymous | Participant | Administrator |
| --- | --- | --- | --- |
| Profiles | No access | Read own; update display name | Read all; role changes are owner-provisioned |
| Participants | No access | Read own; RPC creates/updates own row | Read/update/delete records |
| Competitions | Read published | Read published | Full management |
| Applications | No access | Read own; no direct writes | Full management |
| Audit logs | No access | No access | Read only |

RLS and column grants remain in place. Participants cannot update `profiles.role`, participant `user_id`, or application status. Direct application INSERT remains unavailable to authenticated users.

## Submission RPC

`public.submit_competition_application(uuid,jsonb)` is a `SECURITY DEFINER` function with an empty `search_path` and fully qualified table references. It:

1. Requires an authenticated caller whose database profile role is `participant`.
2. Accepts only the known participant-detail keys and validates required text fields, lengths, age type/range and optional email format.
3. Locks the selected competition row, requires `published` status and checks the registration start/end timestamps using database time.
4. Upserts participant details using only `auth.uid()` as owner; the caller cannot provide participant ID, user ID or application status.
5. Inserts the application in the same transaction. The unique participant/competition constraint rejects duplicates; any failure rolls back the participant upsert as well.
6. Revokes direct execution from PUBLIC, anon and service_role and grants execution only to authenticated users.

The RPC does not implement age eligibility or parental-consent rules; the organization must approve those requirements before they are added.

## Hosted verification boundary

The hosted demo script is [supabase/scripts/phase6_hosted_demo.sql](../supabase/scripts/phase6_hosted_demo.sql). Run it only in the dedicated demo/development project after verifying the project reference. It installs the new RPC and creates one synthetic published competition. It does not create test users or apply the migration to production. Hosted email delivery, migration history and real-user RLS behavior require separate owner-operated checks.

# Architecture — authentication, participant onboarding and database security

## Runtime boundaries

- Supabase Auth manages credentials, email verification and sessions. Passwords are never stored in application tables.
- Public signup creates a `profiles` row with the `participant` role. Signup metadata cannot assign roles.
- The browser uses only the public Supabase URL and anon/publishable key.
- React route guards improve navigation; PostgreSQL grants, RLS and the profile-save RPC enforce authorization.
- Service-role keys and database passwords must never be exposed to browser code.

## Data model

- `auth.users` has a one-to-one relationship with `public.profiles`.
- `public.profiles` has a one-to-zero-or-one relationship with `public.participants`.
- Participant details are stored independently of `public.applications`.
- Competition and application tables remain part of the existing platform schema but are not written by Phase 6.
- `public.audit_logs` stores minimal administrative change metadata, never row contents, credentials or tokens.

## Authorization

| Resource | Anonymous | Participant | Administrator |
| --- | --- | --- | --- |
| Profiles | No access | Read own; update display name only | Read all; role changes remain owner-provisioned |
| Participants | No access | Read own; profile-save RPC writes own row | Existing administrative policies |
| Competitions | Read published | Read published | Existing management policies |
| Applications | No access | Existing read policy; no Phase 6 writes | Existing management policies |
| Audit logs | No access | No access | Read only |

Participant ownership is derived from `auth.uid()`; callers cannot supply `user_id`, participant IDs or roles. Existing RLS and administrative protections are preserved.

## Participant profile RPC

`public.save_participant_profile(jsonb,boolean)` is a SECURITY DEFINER function with an empty `search_path` and fully qualified table references. It requires an authenticated user whose profile role is `participant`, allowlists the existing participant fields, validates types, lengths, age and optional guardian email, and upserts only the caller's participant row.

Partial saves support resuming onboarding after email verification or a browser refresh. The final save validates all required profile fields. The function does not read or write competitions or applications. Execution is revoked from PUBLIC, anon and service_role and granted to authenticated users only.

No parental consent, eligibility or competition-specific requirements are inferred or implemented.

## Hosted verification boundary

The new migration is local-CI tested but has not been applied to hosted Supabase. Reconcile the hosted migration history and review the migration before applying it through the normal deployment process. Never modify the three previously applied migrations or treat local CI as proof of hosted deployment.

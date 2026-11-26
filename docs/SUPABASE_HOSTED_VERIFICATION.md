# Hosted Supabase verification

**Result: 8/8 checks passed** (owner-run against the hosted Supabase project; reported 26 November 2026).

The read-only report is `supabase-hosted-verification-report.sql`. The eight checks cover:

1. RLS enabled on all six application tables.
2. Expected RLS policy coverage.
3. Anonymous users denied access to private tables.
4. Authenticated users denied protected role/ownership column updates.
5. Expected audit and update triggers present.
6. Security-definer settings match the expected functions.
7. Audit function execution privileges are restricted.
8. Application table counts and migration-history availability.

This records the owner's hosted verification result; it is not a claim that GitHub CI executed these remote checks.

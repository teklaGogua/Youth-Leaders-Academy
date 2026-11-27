begin;

create extension if not exists pgtap with schema extensions;
select plan(47);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'participants', 'participants table exists');
select has_table('public', 'competitions', 'competitions table exists');
select has_table('public', 'applications', 'applications table exists');
select has_table('public', 'faq_entries', 'FAQ table exists');
select has_table('public', 'audit_logs', 'audit log table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled for profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.participants'::regclass),
  'RLS is enabled for participants');
select ok((select relrowsecurity from pg_class where oid = 'public.competitions'::regclass),
  'RLS is enabled for competitions');
select ok((select relrowsecurity from pg_class where oid = 'public.applications'::regclass),
  'RLS is enabled for applications');
select ok((select relrowsecurity from pg_class where oid = 'public.faq_entries'::regclass),
  'RLS is enabled for FAQ entries');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_logs'::regclass),
  'RLS is enabled for audit logs');


select ok(has_table_privilege('anon', 'public.competitions', 'SELECT'),
  'anonymous users can select competitions');
select ok(has_table_privilege('anon', 'public.faq_entries', 'SELECT'),
  'anonymous users can select FAQ entries');
select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anonymous users cannot select profiles');
select ok(not has_table_privilege('anon', 'public.participants', 'SELECT'),
  'anonymous users cannot select participant records');
select ok(not has_table_privilege('anon', 'public.applications', 'SELECT'),
  'anonymous users cannot select applications');
select ok(not has_table_privilege('anon', 'public.audit_logs', 'SELECT'),
  'anonymous users cannot select audit logs');

select ok(not has_column_privilege('authenticated', 'public.profiles', 'registration_completed_at', 'UPDATE'),
  'participants cannot set their own registration completion timestamp');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  'authenticated users cannot update profile roles');
select ok(has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE'),
  'authenticated users can update their display name');
select ok(not has_column_privilege('authenticated', 'public.participants', 'user_id', 'UPDATE'),
  'participants cannot change the owner of their participant record');
select ok(not has_column_privilege('authenticated', 'public.participants', 'first_name', 'UPDATE'),
  'participant fields cannot be updated directly; use the validated profile RPC');

select ok(has_function_privilege('anon', 'public.is_administrator()', 'EXECUTE'),
  'anonymous RLS checks can safely call the administrator predicate');
select ok(not has_function_privilege('anon', 'public.write_admin_audit_log()', 'EXECUTE'),
  'anonymous users cannot execute the audit trigger function');
select ok(not has_function_privilege('authenticated', 'public.write_admin_audit_log()', 'EXECUTE'),
  'authenticated users cannot execute the audit trigger function');
select ok(not has_function_privilege('service_role', 'public.write_admin_audit_log()', 'EXECUTE'),
  'service-role clients cannot execute the audit trigger function');

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'applications_admin_manage'
      and cmd = 'ALL'
      and with_check like '%is_administrator%'
  ),
  'application writes are restricted to the administrator policy'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and cmd = 'INSERT'
  ),
  'there is no participant-specific application insert policy'
);

select ok(
  exists (select 1 from pg_trigger where tgname = 'participants_audit' and not tgisinternal),
  'participant changes are recorded in the audit log'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'profiles_role_audit' and not tgisinternal),
  'profile role changes are recorded in the audit log'
);

select ok(not has_table_privilege('authenticated', 'public.participants', 'INSERT'),
  'participants have column-level insert rights only');
select ok(not has_column_privilege('authenticated', 'public.participants', 'user_id', 'INSERT'),
  'participant ownership can only be set by the server-side profile RPC');

select has_table('public','registration_documents','approved legal document versions are stored');
select has_table('public','registration_acceptances','participant legal acceptances are stored');
select has_table('public','parent_email_verification_tokens','parent verification tokens are stored');
select ok((select relrowsecurity from pg_class where oid='public.registration_documents'::regclass),
  'RLS is enabled for published registration documents');
select ok((select relrowsecurity from pg_class where oid='public.registration_acceptances'::regclass),
  'RLS is enabled for participant acceptance records');
select ok((select relrowsecurity from pg_class where oid='public.parent_email_verification_tokens'::regclass),
  'RLS is enabled for private parent verification tokens');
select ok(has_table_privilege('anon','public.registration_documents','SELECT'),
  'anonymous visitors can read only published legal documents');
select ok(not has_table_privilege('anon','public.parent_email_verification_tokens','SELECT'),
  'anonymous visitors cannot read verification tokens');
select ok(not has_table_privilege('authenticated','public.parent_email_verification_tokens','SELECT'),
  'participants cannot read verification tokens');
select ok(not has_function_privilege('anon','public.create_parent_email_verification(uuid,text)','EXECUTE'),
  'anonymous users cannot create parent verification tokens');
select ok(not has_function_privilege('authenticated','public.create_parent_email_verification(uuid,text)','EXECUTE'),
  'participants cannot mint parent verification tokens directly');
select ok(has_function_privilege('authenticated','public.complete_participant_registration(text,text,boolean,boolean)','EXECUTE'),
  'authenticated participants can request server-validated completion');
select ok(not has_function_privilege('anon','public.complete_participant_registration(text,text,boolean,boolean)','EXECUTE'),
  'anonymous users cannot complete participant registration');
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='applications'
    and policyname='applications_read_completed_participant_or_admin'
    and qual like '%registration_completed_at%'),
  'participant application reads require server-recorded registration completion'
);

select * from finish();
rollback;

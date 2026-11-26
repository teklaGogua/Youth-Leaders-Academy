begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

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

select * from finish();
rollback;

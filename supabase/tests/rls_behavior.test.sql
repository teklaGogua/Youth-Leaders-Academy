-- Functional RLS tests using synthetic auth users and JWT claims.
-- All test data is rolled back. Run with npx supabase test db.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(16);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', 'rls-participant@example.test',
    extensions.crypt('SyntheticPassword123', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"RLS Participant"}'::jsonb, now(), now()
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'authenticated', 'authenticated', 'rls-admin@example.test',
    extensions.crypt('SyntheticPassword123', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"RLS Administrator"}'::jsonb, now(), now()
  );

insert into public.participants (user_id, first_name, last_name)
values
  ('33333333-3333-4333-8333-333333333333', 'Nino', 'Test'),
  ('44444444-4444-4444-8444-444444444444', 'Giorgi', 'Admin');

update public.profiles
set role = 'administrator'
where id = '44444444-4444-4444-8444-444444444444';

insert into public.competitions (slug, title, status)
values
  ('rls-published-test', 'RLS published test', 'published'),
  ('rls-draft-test', 'RLS draft test', 'draft');

insert into public.faq_entries (question, answer, is_published)
values
  ('RLS public question', 'Public answer', true),
  ('RLS private question', 'Private answer', false);

insert into public.applications (participant_id, competition_id, status)
select p.id, c.id, 'pending'
from public.participants p
cross join public.competitions c
where p.user_id = '33333333-3333-4333-8333-333333333333'
  and c.slug = 'rls-published-test';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  1,
  'participants can read their own profile'
);
select is(
  (select count(*)::integer from public.participants where user_id = '33333333-3333-4333-8333-333333333333'),
  1,
  'participants can read their own participant record'
);
select is(
  (select count(*)::integer from public.participants where user_id = '44444444-4444-4444-8444-444444444444'),
  0,
  'participants cannot read another participant record'
);
select is(
  (select count(*)::integer from public.applications a join public.participants p on p.id = a.participant_id
   where p.user_id = '33333333-3333-4333-8333-333333333333'),
  1,
  'participants can read their own applications'
);
select is(
  (select count(*)::integer from public.applications a join public.participants p on p.id = a.participant_id
   where p.user_id = '44444444-4444-4444-8444-444444444444'),
  0,
  'participants cannot read another participant application'
);

select throws_ok(
  $$update public.profiles set role = 'administrator'
    where id = '33333333-3333-4333-8333-333333333333'$$,
  '42501',
  null,
  'participants cannot update their profile role'
);
select throws_ok(
  $$update public.participants
    set user_id = '44444444-4444-4444-8444-444444444444'
    where user_id = '33333333-3333-4333-8333-333333333333'$$,
  '42501',
  null,
  'participants cannot change participant record ownership'
);

update public.participants
set first_name = 'Nino Updated'
where user_id = '33333333-3333-4333-8333-333333333333';

update public.applications
set status = 'approved'
where participant_id = (
  select id from public.participants
  where user_id = '33333333-3333-4333-8333-333333333333'
);

select throws_ok(
  $$
    insert into public.applications (participant_id, competition_id, status)
    select p.id, c.id, 'pending'
    from public.participants p
    cross join public.competitions c
    where p.user_id = '33333333-3333-4333-8333-333333333333'
      and c.slug = 'rls-draft-test'
  $$,
  '42501',
  null,
  'participants cannot create applications directly'
);

reset role;

select is(
  (select first_name from public.participants where user_id = '33333333-3333-4333-8333-333333333333'),
  'Nino Updated'::text,
  'participants can update their own editable profile fields'
);
select is(
  (select status::text from public.applications a join public.participants p on p.id = a.participant_id
   where p.user_id = '33333333-3333-4333-8333-333333333333'),
  'pending'::text,
  'participants cannot change application status'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*)::integer from public.competitions where slug = 'rls-published-test'),
  1,
  'anonymous users can read published competitions'
);
select is(
  (select count(*)::integer from public.competitions where slug = 'rls-draft-test'),
  0,
  'anonymous users cannot read draft competitions'
);
select is(
  (select count(*)::integer from public.faq_entries where question = 'RLS public question'),
  1,
  'anonymous users can read published FAQ entries'
);
select is(
  (select count(*)::integer from public.faq_entries where question = 'RLS private question'),
  0,
  'anonymous users cannot read unpublished FAQ entries'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.participants
   where user_id in (
     '33333333-3333-4333-8333-333333333333',
     '44444444-4444-4444-8444-444444444444'
   )),
  2,
  'administrators can read all participant records'
);
select ok(
  (select count(*) > 0 from public.audit_logs),
  'administrators can read audit records'
);

reset role;
select * from finish();
rollback;

-- Phase 6 participant-profile persistence and authorization tests. Synthetic accounts only.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(13);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
('a1111111-1111-4111-8111-111111111111','authenticated','authenticated','phase6-a@example.test',
 extensions.crypt('SyntheticPassword123', extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
('a2222222-2222-4222-8222-222222222222','authenticated','authenticated','phase6-b@example.test',
 extensions.crypt('SyntheticPassword123', extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

update public.profiles set role = 'administrator'
where id = 'a2222222-2222-4222-8222-222222222222';

set local role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Nino","last_name":"Test","age":16,"biography":"Synthetic biography","school":"","grade":"","teacher_name":"","parent_contact_name":"","parent_contact_phone":"","parent_contact_email":""}'::jsonb,
    false
  )$$,
  'participant can save a partial profile before completing onboarding'
);

select is(
  (select count(*)::integer from public.participants where user_id = auth.uid()),
  1,
  'partial profile is saved against the authenticated user'
);

select lives_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Nino","last_name":"Test","age":16,"biography":"Synthetic biography","school":"Synthetic school","grade":"10","teacher_name":"Synthetic teacher","parent_contact_name":"Synthetic guardian","parent_contact_phone":"+995555000000","parent_contact_email":""}'::jsonb,
    true
  )$$,
  'participant can complete the profile'
);

select is(
  (select count(*)::integer from public.participants where user_id = auth.uid()),
  1,
  'completing onboarding updates the existing participant row'
);

select is(
  (select school from public.participants where user_id = auth.uid()),
  'Synthetic school',
  'profile updates persist educational information'
);

select throws_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Nino","last_name":"Test"}'::jsonb, true
  )$$,
  '22023', null,
  'server rejects an incomplete profile marked complete'
);

select throws_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Nino","last_name":"Test","age":"16"}'::jsonb, false
  )$$,
  '22023', null,
  'server rejects invalid field types'
);

select throws_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Nino","last_name":"Test","age":16,"biography":"Bio","school":"School","grade":"10","teacher_name":"Teacher","parent_contact_name":"Guardian","parent_contact_phone":"555","unexpected":"value"}'::jsonb, false
  )$$,
  '22023', null,
  'server rejects unexpected profile fields'
);

select throws_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Nino","last_name":"Test","age":16,"biography":"Bio","school":"School","grade":"10","teacher_name":"Teacher","parent_contact_name":"Guardian","parent_contact_phone":"555","parent_contact_email":"not-an-email"}'::jsonb, false
  )$$,
  '22023', null,
  'server validates optional guardian email'
);

select throws_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Nino","last_name":"Test","age":0}'::jsonb, false
  )$$,
  '22023', null,
  'server rejects invalid age'
);

select is(
  (select count(*)::integer from public.participants where user_id = 'a2222222-2222-4222-8222-222222222222'),
  0,
  'participant cannot read another account profile'
);

select ok(
  not has_function_privilege('anon','public.save_participant_profile(jsonb,boolean)','EXECUTE'),
  'anonymous role cannot execute profile persistence RPC'
);

select set_config('request.jwt.claims',
 '{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

select throws_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Admin","last_name":"Test"}'::jsonb, false
  )$$,
  '42501', null,
  'administrator accounts cannot write participant profiles'
);

reset role;
select * from finish();
rollback;

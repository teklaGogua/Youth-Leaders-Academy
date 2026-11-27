begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(17);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '99999999-9999-4999-8999-999999999999',
  'authenticated', 'authenticated', 'registration-test@example.test',
  extensions.crypt('SyntheticPassword123', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Registration Test"}'::jsonb, now(), now()
);

update public.legal_documents set approved_at = now()
where document_type in ('terms', 'privacy') and is_current;

select has_table('public', 'participant_registrations', 'registration table exists');
select has_table('public', 'guardian_verification_tokens', 'guardian token table exists');
select ok(
  not has_table_privilege('authenticated', 'public.participant_registrations', 'INSERT'),
  'participants cannot insert registration rows directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.confirm_guardian_verification(text,boolean)', 'EXECUTE'),
  'participants cannot invoke the private guardian confirmation RPC'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_participant_registration_step(2, '{"school":"School","grade":"8","teacherName":"Teacher"}'::jsonb)$$,
  '23514', null, 'education cannot be saved before personal information'
);
select lives_ok(
  $$select public.save_participant_registration_step(1, '{"firstName":"Ana","lastName":"Test","age":14,"biography":"A participant biography."}'::jsonb)$$,
  'valid personal information can be saved'
);
select lives_ok(
  $$select public.save_participant_registration_step(2, '{"school":"School 1","grade":"8","teacherName":"Teacher Test"}'::jsonb)$$,
  'valid education information can be saved'
);
select lives_ok(
  $$select public.save_participant_registration_step(3, '{"guardianFullName":"Parent Test","guardianPhone":"+995555123456","guardianEmail":"parent@example.test"}'::jsonb)$$,
  'guardian information is mandatory and can be saved'
);
select is(
  (select guardian_verified_at is null from public.participant_registrations
   where user_id = '99999999-9999-4999-8999-999999999999'),
  true, 'saving guardian details does not imply email verification'
);

reset role;
insert into public.guardian_verification_tokens (
  user_id, guardian_email, token_hash, expires_at
) values (
  '99999999-9999-4999-8999-999999999999',
  'parent@example.test', repeat('a', 64), now() + interval '30 minutes'
);
set local role service_role;
select is(
  public.confirm_guardian_verification(repeat('a', 64), false),
  true, 'valid guardian token verifies the email'
);
reset role;
set local role authenticated;
select is(
  (select parental_consent_at is null from public.participant_registrations
   where user_id = '99999999-9999-4999-8999-999999999999'),
  true, 'email verification alone does not record parental consent'
);
reset role;
set local role service_role;
select is(
  public.confirm_guardian_verification(repeat('a', 64), true),
  false, 'a guardian verification token cannot be reused'
);
reset role;

insert into public.guardian_verification_tokens (
  user_id, guardian_email, token_hash, expires_at
) values (
  '99999999-9999-4999-8999-999999999999',
  'parent@example.test', repeat('b', 64), now() + interval '30 minutes'
);
set local role service_role;
select is(
  public.confirm_guardian_verification(repeat('b', 64), true),
  true, 'guardian can explicitly record consent in a separate affirmative action'
);
reset role;
set local role authenticated;
select is(
  (select parental_consent_at is not null from public.participant_registrations
   where user_id = '99999999-9999-4999-8999-999999999999'),
  true, 'explicit guardian consent has its own timestamp'
);
select lives_ok(
  $$select public.save_participant_registration_step(4, '{"termsAccepted":true,"privacyAccepted":true,"termsVersion":"0.1-placeholder","privacyVersion":"0.1-placeholder"}'::jsonb)$$,
  'legal acceptance records the current approved document versions'
);
select is(
  public.complete_participant_registration(),
  true, 'registration completes only after all requirements are met'
);
reset role;
select is(
  (select completed_at is not null from public.participant_registrations
   where user_id = '99999999-9999-4999-8999-999999999999'),
  true, 'completion timestamp is persisted'
);

select * from finish();
rollback;

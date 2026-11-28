begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(36);

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

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '88888888-8888-4888-8888-888888888888',
  'authenticated', 'authenticated', 'other-registration@example.test',
  extensions.crypt('SyntheticPassword123', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Other Participant"}'::jsonb, now(), now()
);
insert into public.participant_registrations (user_id)
values ('88888888-8888-4888-8888-888888888888');


select has_table('public', 'participant_registrations', 'registration table exists');
select has_table('public', 'guardian_verification_tokens', 'guardian token table exists');
select ok(not has_table_privilege('authenticated', 'public.participant_registrations', 'INSERT'),
  'participants cannot insert registration rows directly');
select ok(not has_table_privilege('authenticated', 'public.participant_registrations', 'UPDATE'),
  'participants cannot update registration rows directly');
select ok(not has_table_privilege('authenticated', 'public.participant_registrations', 'DELETE'),
  'participants cannot delete registration rows directly');
select ok(not has_function_privilege('authenticated', 'public.confirm_guardian_decision(text,boolean,text,text,text)', 'EXECUTE'),
  'participants cannot invoke the private guardian decision RPC');
select ok(not has_function_privilege('authenticated', 'public.validate_guardian_decision_token(text)', 'EXECUTE'),
  'participants cannot invoke the private guardian token validation RPC');
select ok(has_function_privilege('service_role', 'public.validate_guardian_decision_token(text)', 'EXECUTE'),
  'the edge-function service role can validate guardian decision tokens');
select ok(has_function_privilege('service_role', 'public.confirm_guardian_decision(text,boolean,text,text,text)', 'EXECUTE'),
  'the edge-function service role can record guardian decisions');
select ok(has_function_privilege('authenticated', 'public.save_participant_registration_step(integer,jsonb)', 'EXECUTE'),
  'participants can save registration steps through the guarded RPC');
select ok(has_function_privilege('authenticated', 'public.complete_participant_registration()', 'EXECUTE'),
  'participants can complete registration through the guarded RPC');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}', true);

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
select throws_ok(
  'select public.complete_participant_registration()',
  '23514', null, 'incomplete registration cannot be finalized'
);
select is(
  (select count(*)::integer from public.participant_registrations),
  1, 'participants can read only their own registration row'
);

reset role;
insert into public.guardian_verification_tokens (
  user_id, guardian_email, token_hash, purpose, expires_at
) values (
  '99999999-9999-4999-8999-999999999999',
  'parent@example.test', repeat('a', 64), 'verification', now() + interval '30 minutes'
);
set local role service_role;
select is(public.validate_guardian_decision_token(repeat('a', 64)),
  true, 'valid guardian decision token can be validated without being consumed');
select is(public.confirm_guardian_decision(repeat('a', 64), true, '0.1-placeholder', '0.1-placeholder', '0.1-placeholder'),
  'success'::text, 'guardian agree verifies email and records consent in one transaction');
reset role;
set local role authenticated;
select is(
  (select guardian_verified_at is not null
      and guardian_verified_email = guardian_email
      and parental_consent_at is not null
      and parental_consent_terms_version = '0.1-placeholder'
      and parental_consent_privacy_version = '0.1-placeholder'
      and parental_consent_version = '0.1-placeholder'
    from public.participant_registrations
    where user_id = '99999999-9999-4999-8999-999999999999'),
  true, 'guardian email verification and explicit consent are recorded atomically'
);
reset role;
set local role service_role;
select is(public.confirm_guardian_decision(repeat('a', 64), true, '0.1-placeholder', '0.1-placeholder', '0.1-placeholder'),
  'invalid'::text, 'a guardian decision token cannot be reused');
reset role;
insert into public.guardian_verification_tokens (
  user_id, guardian_email, token_hash, purpose, expires_at
) values (
  '99999999-9999-4999-8999-999999999999',
  'parent@example.test', repeat('f', 64), 'verification', now() + interval '30 minutes'
);
update public.legal_documents set version = '0.2-test'
where document_type = 'terms' and is_current;
set local role service_role;
select is(public.confirm_guardian_decision(repeat('f', 64), true,
  '0.1-placeholder', '0.1-placeholder', '0.1-placeholder'),
  'stale'::text, 'a changed document version prevents recording the stale review');
select is((select used_at is null from public.guardian_verification_tokens
  where token_hash = repeat('f', 64)), true,
  'a stale review does not consume the guardian link');
reset role;
update public.legal_documents set version = '0.1-placeholder'
where document_type = 'terms' and is_current;
set local role service_role;
select is(public.confirm_guardian_decision(repeat('f', 64), true,
  '0.1-placeholder', '0.1-placeholder', '0.1-placeholder'),
  'success'::text, 'the same unconsumed link succeeds after the guardian reviews current versions');
reset role;
insert into public.guardian_verification_tokens (
  user_id, guardian_email, token_hash, purpose, expires_at
) values (
  '99999999-9999-4999-8999-999999999999',
  'parent@example.test', repeat('c', 64), 'verification', now() - interval '1 minute'
);
set local role service_role;
select is(public.confirm_guardian_decision(repeat('c', 64), true, '0.1-placeholder', '0.1-placeholder', '0.1-placeholder'),
  'invalid'::text, 'expired guardian decision tokens are rejected');
reset role;
insert into public.guardian_verification_tokens (
  user_id, guardian_email, token_hash, purpose, expires_at
) values (
  '99999999-9999-4999-8999-999999999999',
  'someone-else@example.test', repeat('d', 64), 'verification', now() + interval '30 minutes'
);
set local role service_role;
select is(public.confirm_guardian_decision(repeat('d', 64), true, '0.1-placeholder', '0.1-placeholder', '0.1-placeholder'),
  'invalid'::text, 'decision tokens are bound to the exact guardian email');
reset role;
-- A rejection consumes the token and never creates consent.
reset role;
update public.participant_registrations set
  guardian_full_name = 'Other Parent', guardian_phone = '+995555000000',
  guardian_email = 'other-parent@example.test', step_3_completed_at = now()
where user_id = '88888888-8888-4888-8888-888888888888';
insert into public.guardian_verification_tokens (user_id, guardian_email, token_hash, purpose, expires_at)
values ('88888888-8888-4888-8888-888888888888', 'other-parent@example.test', repeat('e', 64), 'verification', now() + interval '30 minutes');
set local role service_role;
select is(public.confirm_guardian_decision(repeat('e', 64), false, null, null, null),
  'success'::text, 'guardian rejection is explicitly recorded');
reset role;
select is((select parental_consent_at is null and parental_consent_rejected_at is not null
    from public.participant_registrations
    where user_id = '88888888-8888-4888-8888-888888888888'),
  true, 'guardian rejection is timestamped without creating parental consent');
insert into public.guardian_verification_tokens (user_id, guardian_email, token_hash, purpose, expires_at)
values ('88888888-8888-4888-8888-888888888888', 'other-parent@example.test', repeat('g', 64),
  'verification', now() + interval '30 minutes');
update public.participant_registrations set step_1_completed_at = now(), step_2_completed_at = now()
where user_id = '88888888-8888-4888-8888-888888888888';
set local role authenticated;
select lives_ok(
  $$select public.save_participant_registration_step(3, '{"guardianFullName":"Other Parent Updated","guardianPhone":"+995555000000","guardianEmail":"other-parent@example.test"}'::jsonb)$$,
  'editing guardian details with the same email remains a valid save');
reset role;
select is((select used_at is not null from public.guardian_verification_tokens
  where token_hash = repeat('g', 64)), true,
  'editing guardian name or phone invalidates an outstanding link even when email is unchanged');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
select throws_ok('select public.complete_participant_registration()',
  '23514', null, 'a rejected guardian decision cannot complete participant registration');
reset role;

-- A guardian's approval is tied to the current guardian declaration version.
reset role;
update public.legal_documents
set version = '0.2-test'
where document_type = 'guardian_consent' and is_current;
set local role authenticated;
select throws_ok(
  $$select public.save_participant_registration_step(4, '{"termsAccepted":true,"privacyAccepted":true,"termsVersion":"0.1-placeholder","privacyVersion":"0.1-placeholder"}'::jsonb)$$,
  '23514', null, 'Step 4 rejects guardian consent captured against an outdated guardian declaration'
);
reset role;
update public.legal_documents
set version = '0.1-placeholder'
where document_type = 'guardian_consent' and is_current;
set local role authenticated;
select lives_ok(
  $$select public.save_participant_registration_step(4, '{"termsAccepted":true,"privacyAccepted":true,"termsVersion":"0.1-placeholder","privacyVersion":"0.1-placeholder"}'::jsonb)$$,
  'participant can accept current placeholder legal documents without approval metadata'
);
select is(public.complete_participant_registration(),
  true, 'registration completes after guardian consent and participant acceptance');
reset role;
select is(
  (select completed_at is not null from public.participant_registrations
   where user_id = '99999999-9999-4999-8999-999999999999'),
  true, 'completion timestamp is persisted'
);

select * from finish();
rollback;

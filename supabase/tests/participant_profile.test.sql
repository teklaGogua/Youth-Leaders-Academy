-- End-to-end database enforcement for participant registration. Synthetic identities only.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(33);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
('a1111111-1111-4111-8111-111111111111','authenticated','authenticated','phase6-a@example.test',
 extensions.crypt('SyntheticPassword123', extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
('a2222222-2222-4222-8222-222222222222','authenticated','authenticated','phase6-unconfirmed@example.test',
 extensions.crypt('SyntheticPassword123', extensions.gen_salt('bf')),null,
 '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
('a3333333-3333-4333-8333-333333333333','authenticated','authenticated','phase6-admin@example.test',
 extensions.crypt('SyntheticPassword123', extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
('a4444444-4444-4444-8444-444444444444','authenticated','authenticated','phase6-parent-change@example.test',
 extensions.crypt('SyntheticPassword123', extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

update public.profiles set role = 'administrator'
where id = 'a3333333-3333-4333-8333-333333333333';

insert into public.registration_documents(slug,version,title,content,is_published) values
('terms','test-terms-v1','Synthetic Terms','Approved test-only terms',true),
('privacy','test-privacy-v1','Synthetic Privacy','Approved test-only privacy',true);

create temporary table phase6_tokens(label text primary key, token text not null);
grant select, insert on phase6_tokens to service_role;

set local role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Nino","last_name":"Test","age":16,"biography":"Synthetic biography","school":"","grade":"","teacher_name":"","parent_contact_name":"","parent_contact_phone":"","parent_contact_email":""}'::jsonb,
    false
  )$$,
  'verified participant can save an early partial profile without a guardian email'
);
select is(
  (select count(*)::integer from public.get_participant_registration_profile()),
  1,
  'incomplete participant can retrieve only their own draft through the guarded RPC'
);
select is(
  (select count(*)::integer from public.participants where user_id = auth.uid()),
  0,
  'incomplete participant cannot read the dashboard table directly'
);
select lives_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Nino","last_name":"Test","age":16,"biography":"Synthetic biography","school":"Synthetic school","grade":"10","teacher_name":"Synthetic teacher","parent_contact_name":"Synthetic guardian","parent_contact_phone":"+995555000000","parent_contact_email":"guardian-one@example.test"}'::jsonb,
    false
  )$$,
  'participant can save all mandatory profile fields before parent verification'
);
select throws_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Nino","last_name":"Test","age":16}'::jsonb, true
  )$$,
  '22023', null,
  'legacy completion flag cannot bypass parent verification or terms'
);
select throws_ok(
  $$select public.complete_participant_registration('test-terms-v1','test-privacy-v1')$$,
  '22023', null,
  'registration cannot complete before parent email verification'
);
select throws_ok(
  $$update public.participants set first_name = 'Bypass'
    where user_id = auth.uid()$$,
  '42501', null,
  'direct participant updates are denied'
);
select throws_ok(
  $$insert into public.participants(user_id,first_name)
    values ('a1111111-1111-4111-8111-111111111111','Bypass')$$,
  '42501', null,
  'direct participant inserts are denied'
);
select is(
  (select count(*)::integer from public.participants where user_id = 'a3333333-3333-4333-8333-333333333333'),
  0,
  'participant cannot read an administrator participant row'
);
select ok(not has_function_privilege('anon','public.save_participant_profile(jsonb,boolean)','EXECUTE'),
  'anonymous users cannot save participant profiles');
select ok(has_function_privilege('authenticated','public.save_participant_profile(jsonb,boolean)','EXECUTE'),
  'authenticated participants can use the validated partial-save RPC');

reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok(
  $$insert into phase6_tokens(label,token)
    select 'first', public.create_parent_email_verification(
      'a1111111-1111-4111-8111-111111111111','guardian-one@example.test'
    )$$,
  'trusted email service can create a hashed verification token'
);
select lives_ok(
  $$select public.verify_parent_email_token((select token from phase6_tokens where label='first'))$$,
  'first parent verification link is accepted'
);
select ok(
  (select parent_contact_email_verified_at is not null from public.participants
    where user_id='a1111111-1111-4111-8111-111111111111'),
  'parent verification timestamp is stored server-side'
);
select is(
  public.verify_parent_email_token((select token from phase6_tokens where label='first')),
  false,
  'parent verification token cannot be replayed'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Nino","last_name":"Test","age":16,"biography":"Synthetic biography","school":"Synthetic school","grade":"10","teacher_name":"Synthetic teacher","parent_contact_name":"Synthetic guardian","parent_contact_phone":"+995555000000","parent_contact_email":"guardian-two@example.test"}'::jsonb,
    false
  )$$,
  'changing the parent email is saved as a new unverified address'
);
select is(
  (select parent_contact_email_verified_at from public.participants
    where user_id=auth.uid()),
  null::timestamptz,
  'changing parent email invalidates the old verification'
);
select throws_ok(
  $$select public.complete_participant_registration('test-terms-v1','test-privacy-v1')$$,
  '22023', null,
  'old parent verification cannot complete registration after email change'
);

reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok(
  $$insert into phase6_tokens(label,token)
    select 'expired', public.create_parent_email_verification(
      'a1111111-1111-4111-8111-111111111111','guardian-two@example.test'
    )$$,
  'email service can issue a replacement token'
);
update public.parent_email_verification_tokens
set expires_at = now() - interval '1 second'
where token_hash = encode(extensions.digest(convert_to(
  (select token from phase6_tokens where label='expired'),'UTF8'),'sha256'),'hex');
select is(
  public.verify_parent_email_token((select token from phase6_tokens where label='expired')),
  false,
  'expired parent verification token is rejected'
);
select lives_ok(
  $$insert into phase6_tokens(label,token)
    select 'replacement', public.create_parent_email_verification(
      'a1111111-1111-4111-8111-111111111111','guardian-two@example.test'
    )$$,
  'replacement email verification can be issued within rate limit'
);
select lives_ok(
  $$select public.verify_parent_email_token((select token from phase6_tokens where label='replacement'))$$,
  'replacement parent email can be verified'
);
select throws_ok(
  $$select public.create_parent_email_verification(
    'a1111111-1111-4111-8111-111111111111','guardian-two@example.test'
  )$$,
  'P0001', null,
  'parent verification resend is rate limited after three requests in one hour'
);

-- A pending token for a second synthetic participant must become unusable if the
-- guardian email changes before the link is opened.
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"a4444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
select lives_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Test","last_name":"Parent","age":16,"biography":"Synthetic","school":"Synthetic","grade":"10","teacher_name":"Synthetic","parent_contact_name":"Guardian","parent_contact_phone":"+995555000004","parent_contact_email":"old-guardian@example.test"}'::jsonb,
    false
  )$$,
  'second synthetic participant saves an unverified parent email'
);
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok(
  $$insert into phase6_tokens(label,token)
    select 'pending-old-email', public.create_parent_email_verification(
      'a4444444-4444-4444-8444-444444444444','old-guardian@example.test'
    )$$,
  'verification token is issued for the old guardian email'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"a4444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
select lives_ok(
  $$select public.save_participant_profile(
    '{"first_name":"Test","last_name":"Parent","age":16,"biography":"Synthetic","school":"Synthetic","grade":"10","teacher_name":"Synthetic","parent_contact_name":"Guardian","parent_contact_phone":"+995555000004","parent_contact_email":"new-guardian@example.test"}'::jsonb,
    false
  )$$,
  'changing the guardian address invalidates its pending verification token'
);
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(
  public.verify_parent_email_token((select token from phase6_tokens where label='pending-old-email')),
  false,
  'a pending token cannot verify a subsequently changed guardian address'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$select public.complete_participant_registration('stale-terms-version','test-privacy-v1')$$,
  '22023', null,
  'server rejects stale or unaccepted legal document versions'
);
select lives_ok(
  $$select public.complete_participant_registration('test-terms-v1','test-privacy-v1')$$,
  'participant completes only after both email checks, all required fields and active document versions'
);
select ok(
  (select registration_completed_at is not null from public.profiles
    where id='a1111111-1111-4111-8111-111111111111'),
  'completion state is stored in the protected profile row'
);
select is(
  (select terms_version || '/' || privacy_version from public.registration_acceptances
    where user_id=auth.uid()),
  'test-terms-v1/test-privacy-v1',
  'exact accepted Terms and Privacy versions are stored'
);

select set_config('request.jwt.claims',
 '{"sub":"a3333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select throws_ok(
  $$select public.save_participant_profile('{"first_name":"Admin"}'::jsonb,false)$$,
  '42501', null,
  'administrator cannot use participant profile registration RPC'
);
select set_config('request.jwt.claims',
 '{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select throws_ok(
  $$select public.save_participant_profile('{"first_name":"Unconfirmed"}'::jsonb,false)$$,
  '42501', null,
  'unconfirmed participant cannot save profile registration data'
);

reset role;
select * from finish();
rollback;

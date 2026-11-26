-- Phase 6 transactional submission security tests. Synthetic users/data only.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
('a1111111-1111-4111-8111-111111111111','authenticated','authenticated','phase6-a@example.test',
 extensions.crypt('SyntheticPassword123', extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Participant A"}'::jsonb,now(),now()),
('a2222222-2222-4222-8222-222222222222','authenticated','authenticated','phase6-b@example.test',
 extensions.crypt('SyntheticPassword123', extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Participant B"}'::jsonb,now(),now());

insert into public.competitions (id,slug,title,status,registration_start,registration_end)
values
('a3333333-3333-4333-8333-333333333333','phase6-open','Phase 6 open','published',now()-interval '1 day',now()+interval '1 day'),
('a4444444-4444-4444-8444-444444444444','phase6-closed','Phase 6 closed','published',now()-interval '2 days',now()-interval '1 day'),
('a5555555-5555-4555-8555-555555555555','phase6-draft','Phase 6 draft','draft',now()-interval '1 day',now()+interval '1 day');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);

select is((select count(*)::integer from public.submit_competition_application(
 'a3333333-3333-4333-8333-333333333333',
 '{"first_name":"Nino","last_name":"Test","school":"School","grade":"10","parent_contact_phone":"+995555000000"}'::jsonb
)),1,'authenticated participant submits one application');

select is((select count(*)::integer from public.participants
 where user_id='a1111111-1111-4111-8111-111111111111'),1,'participant details are tied to auth.uid');

select throws_ok(
 $$select * from public.submit_competition_application(
 'a3333333-3333-4333-8333-333333333333',
 '{"first_name":"Other","last_name":"User"}'::jsonb
 )$$,'23505',null,'duplicate application is rejected');

select throws_ok(
 $$select * from public.submit_competition_application(
 'a4444444-4444-4444-8444-444444444444','{"first_name":"Nino"}'::jsonb
 )$$,'P0001',null,'closed registration deadline is enforced');

select throws_ok(
 $$select * from public.submit_competition_application(
 'a5555555-5555-4555-8555-555555555555','{"first_name":"Nino"}'::jsonb
 )$$,'P0002',null,'draft competition cannot receive applications');

select throws_ok(
 $$insert into public.applications(participant_id,competition_id,status)
 select id,'a3333333-3333-4333-8333-333333333333','approved'
 from public.participants where user_id='a1111111-1111-4111-8111-111111111111'$$,
 '42501',null,'participant cannot insert applications directly');

select throws_ok(
 $$update public.applications set status='approved'
 where competition_id='a3333333-3333-4333-8333-333333333333'$$,
 '42501',null,'participant cannot change application status');

select is((select count(*)::integer from public.participants
 where user_id='a2222222-2222-4222-8222-222222222222'),0,
 'participant cannot create or access another participant record');

select is((select count(*)::integer from public.applications
 where competition_id='a3333333-3333-4333-8333-333333333333'),1,
 'only one application exists for participant and competition');

select is((select status::text from public.applications
 where competition_id='a3333333-3333-4333-8333-333333333333'),
 'registered','application status is database-controlled');

select ok(not has_function_privilege('anon',
 'public.submit_competition_application(uuid,jsonb)','EXECUTE'),
 'anonymous role cannot execute submission RPC');

reset role;
select ok(not has_function_privilege('public',
 'public.submit_competition_application(uuid,jsonb)','EXECUTE'),
 'public role cannot execute submission RPC');

select * from finish();
rollback;

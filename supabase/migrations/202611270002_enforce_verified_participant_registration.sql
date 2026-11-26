-- Additive Phase 6 correction: enforce verified, complete participant registration.
-- Never edit the three previously applied migrations or the hosted Phase 6 profile migration.

alter table public.profiles
  add column if not exists registration_completed_at timestamptz;

alter table public.participants
  add column if not exists parent_contact_email_verified_at timestamptz;

create table if not exists public.registration_documents (
  slug text primary key check (slug in ('terms', 'privacy')),
  version text not null,
  title text not null,
  content text not null,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.registration_acceptances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now()
);

create table if not exists public.parent_email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists parent_email_verification_user_created_idx
  on public.parent_email_verification_tokens(user_id, created_at desc);

alter table public.registration_documents enable row level security;
alter table public.registration_acceptances enable row level security;
alter table public.parent_email_verification_tokens enable row level security;

revoke all on public.registration_documents, public.registration_acceptances,
  public.parent_email_verification_tokens from anon, authenticated;
grant select on public.registration_documents to anon, authenticated;
grant select on public.registration_acceptances to authenticated;

drop policy if exists registration_documents_public_read on public.registration_documents;
create policy registration_documents_public_read on public.registration_documents
  for select to anon, authenticated using (is_published);
drop policy if exists registration_acceptances_read_own_or_admin on public.registration_acceptances;
create policy registration_acceptances_read_own_or_admin on public.registration_acceptances
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_administrator()));

-- Remove the direct INSERT/UPDATE column grants from the older hardening migration.
-- Participants can read their own draft row; all writes now go through the SECURITY DEFINER RPC.
revoke all on table public.participants from authenticated;
grant select on table public.participants to authenticated;
revoke insert (user_id, first_name, last_name, age, biography, school, grade, teacher_name,
  parent_contact_name, parent_contact_phone, parent_contact_email)
  on table public.participants from authenticated;
revoke update (first_name, last_name, age, biography, school, grade, teacher_name,
  parent_contact_name, parent_contact_phone, parent_contact_email)
  on table public.participants from authenticated;
revoke delete on table public.participants from authenticated;

create or replace function public.save_participant_profile(
  p_participant jsonb,
  p_complete boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role public.app_role;
  v_email_confirmed_at timestamptz;
  v_allowed_keys text[] := array[
    'first_name','last_name','age','biography','school','grade','teacher_name',
    'parent_contact_name','parent_contact_phone','parent_contact_email'
  ];
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select role into v_role from public.profiles where id = v_user_id;
  if v_role is distinct from 'participant'::public.app_role then
    raise exception 'Participant role required' using errcode = '42501';
  end if;
  select email_confirmed_at into v_email_confirmed_at from auth.users where id = v_user_id;
  if v_email_confirmed_at is null then
    raise exception 'Participant email must be verified before profile completion' using errcode = '42501';
  end if;
  if p_complete then
    raise exception 'Use complete_participant_registration after parent verification and terms acceptance'
      using errcode = '22023';
  end if;
  if p_participant is null or jsonb_typeof(p_participant) is distinct from 'object' then
    raise exception 'Invalid participant profile' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_participant) supplied(key)
    where not (supplied.key = any(v_allowed_keys))
  ) then raise exception 'Unexpected participant field' using errcode = '22023'; end if;

  if jsonb_typeof(p_participant -> 'first_name') not in ('string','null')
    or jsonb_typeof(p_participant -> 'last_name') not in ('string','null')
    or jsonb_typeof(p_participant -> 'biography') not in ('string','null')
    or jsonb_typeof(p_participant -> 'school') not in ('string','null')
    or jsonb_typeof(p_participant -> 'grade') not in ('string','null')
    or jsonb_typeof(p_participant -> 'teacher_name') not in ('string','null')
    or jsonb_typeof(p_participant -> 'parent_contact_name') not in ('string','null')
    or jsonb_typeof(p_participant -> 'parent_contact_phone') not in ('string','null')
    or jsonb_typeof(p_participant -> 'parent_contact_email') not in ('string','null')
    or (p_participant ? 'age' and jsonb_typeof(p_participant -> 'age') not in ('number','null')) then
    raise exception 'Participant fields have invalid types' using errcode = '22023';
  end if;

  if length(coalesce(p_participant ->> 'first_name','')) > 100
    or length(coalesce(p_participant ->> 'last_name','')) > 100
    or length(coalesce(p_participant ->> 'biography','')) > 500
    or length(coalesce(p_participant ->> 'school','')) > 200
    or length(coalesce(p_participant ->> 'grade','')) > 30
    or length(coalesce(p_participant ->> 'teacher_name','')) > 150
    or length(coalesce(p_participant ->> 'parent_contact_name','')) > 150
    or length(coalesce(p_participant ->> 'parent_contact_phone','')) > 40
    or length(coalesce(p_participant ->> 'parent_contact_email','')) > 254 then
    raise exception 'Participant field exceeds its maximum length' using errcode = '22023';
  end if;
  if nullif(btrim(p_participant ->> 'parent_contact_email'),'') is not null
    and btrim(p_participant ->> 'parent_contact_email') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Parent or guardian email is invalid' using errcode = '22023';
  end if;
  if p_participant ? 'age' and p_participant -> 'age' <> 'null'::jsonb
    and ((p_participant ->> 'age') !~ '^[0-9]+$'
      or (p_participant ->> 'age')::numeric < 1
      or (p_participant ->> 'age')::numeric > 32767) then
    raise exception 'Age must be a positive whole number' using errcode = '22023';
  end if;

  insert into public.participants (
    user_id, first_name, last_name, age, biography, school, grade, teacher_name,
    parent_contact_name, parent_contact_phone, parent_contact_email,
    parent_contact_email_verified_at
  ) values (
    v_user_id,
    nullif(btrim(p_participant ->> 'first_name'),''),
    nullif(btrim(p_participant ->> 'last_name'),''),
    case when p_participant -> 'age' is null or p_participant -> 'age' = 'null'::jsonb
      then null else (p_participant ->> 'age')::smallint end,
    nullif(btrim(p_participant ->> 'biography'),''),
    nullif(btrim(p_participant ->> 'school'),''),
    nullif(btrim(p_participant ->> 'grade'),''),
    nullif(btrim(p_participant ->> 'teacher_name'),''),
    nullif(btrim(p_participant ->> 'parent_contact_name'),''),
    nullif(btrim(p_participant ->> 'parent_contact_phone'),''),
    nullif(lower(btrim(p_participant ->> 'parent_contact_email')),''),
    null
  )
  on conflict (user_id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    age = excluded.age,
    biography = excluded.biography,
    school = excluded.school,
    grade = excluded.grade,
    teacher_name = excluded.teacher_name,
    parent_contact_name = excluded.parent_contact_name,
    parent_contact_phone = excluded.parent_contact_phone,
    parent_contact_email_verified_at = case
      when lower(coalesce(public.participants.parent_contact_email,'')) = lower(coalesce(excluded.parent_contact_email,''))
        then public.participants.parent_contact_email_verified_at
      else null end,
    parent_contact_email = excluded.parent_contact_email;

  update public.profiles set registration_completed_at = null where id = v_user_id;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Invalid participant profile' using errcode = '22023';
end;
$$;

create or replace function public.create_parent_email_verification(
  p_user_id uuid,
  p_email text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_stored_email text;
begin
  if coalesce(auth.role(),'') <> 'service_role' and current_user not in ('postgres','supabase_admin') then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select parent_contact_email into v_stored_email
  from public.participants where user_id = p_user_id for update;
  if not found or v_stored_email is null or lower(v_stored_email) <> lower(btrim(p_email)) then
    raise exception 'Parent email does not match the saved profile' using errcode = '22023';
  end if;
  if (select count(*) from public.parent_email_verification_tokens
      where user_id = p_user_id and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Verification email rate limit exceeded' using errcode = 'P0001';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.parent_email_verification_tokens(user_id,email,token_hash,expires_at)
  values (p_user_id,lower(btrim(p_email)),encode(extensions.digest(convert_to(v_token,'UTF8'),'sha256'),'hex'),now()+interval '30 minutes');
  return v_token;
end;
$$;

create or replace function public.verify_parent_email_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.parent_email_verification_tokens%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' and current_user not in ('postgres','supabase_admin') then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then return false; end if;
  select * into v_row from public.parent_email_verification_tokens
  where token_hash = encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex')
    and consumed_at is null and expires_at > now()
  for update;
  if not found then return false; end if;
  update public.participants
  set parent_contact_email_verified_at = now()
  where user_id = v_row.user_id and lower(parent_contact_email) = lower(v_row.email);
  if not found then return false; end if;
  update public.parent_email_verification_tokens set consumed_at = now() where id = v_row.id;
  return true;
end;
$$;

create or replace function public.complete_participant_registration(
  p_terms_version text,
  p_privacy_version text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role public.app_role;
  v_confirmed_at timestamptz;
  v_participant public.participants%rowtype;
  v_terms_version text;
  v_privacy_version text;
  v_accepted_at timestamptz := now();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select role into v_role from public.profiles where id = v_user_id for update;
  if v_role is distinct from 'participant'::public.app_role then
    raise exception 'Participant role required' using errcode = '42501';
  end if;
  select email_confirmed_at into v_confirmed_at from auth.users where id = v_user_id;
  if v_confirmed_at is null then raise exception 'Participant email is not verified' using errcode = '42501'; end if;
  select * into v_participant from public.participants where user_id = v_user_id for update;
  if not found
    or nullif(btrim(v_participant.first_name),'') is null
    or nullif(btrim(v_participant.last_name),'') is null
    or v_participant.age is null or v_participant.age < 1
    or nullif(btrim(v_participant.biography),'') is null
    or nullif(btrim(v_participant.school),'') is null
    or nullif(btrim(v_participant.grade),'') is null
    or nullif(btrim(v_participant.teacher_name),'') is null
    or nullif(btrim(v_participant.parent_contact_name),'') is null
    or nullif(btrim(v_participant.parent_contact_phone),'') is null
    or nullif(btrim(v_participant.parent_contact_email),'') is null
    or v_participant.parent_contact_email_verified_at is null then
    raise exception 'Required profile fields and parent email verification are incomplete' using errcode = '22023';
  end if;
  select version into v_terms_version from public.registration_documents
    where slug = 'terms' and is_published;
  select version into v_privacy_version from public.registration_documents
    where slug = 'privacy' and is_published;
  if v_terms_version is null or v_privacy_version is null
    or p_terms_version is distinct from v_terms_version
    or p_privacy_version is distinct from v_privacy_version then
    raise exception 'Approved Terms and Privacy documents must be published and accepted' using errcode = '22023';
  end if;
  insert into public.registration_acceptances(user_id,terms_version,privacy_version,accepted_at)
  values (v_user_id,v_terms_version,v_privacy_version,v_accepted_at)
  on conflict (user_id) do update set
    terms_version = excluded.terms_version,
    privacy_version = excluded.privacy_version,
    accepted_at = excluded.accepted_at;
  update public.profiles set registration_completed_at = v_accepted_at where id = v_user_id;
  return v_accepted_at;
end;
$$;

revoke all on function public.save_participant_profile(jsonb,boolean) from public, anon, service_role;
grant execute on function public.save_participant_profile(jsonb,boolean) to authenticated;
revoke all on function public.create_parent_email_verification(uuid,text) from public, anon, authenticated;
grant execute on function public.create_parent_email_verification(uuid,text) to service_role;
revoke all on function public.verify_parent_email_token(text) from public, anon, authenticated;
grant execute on function public.verify_parent_email_token(text) to service_role;
revoke all on function public.complete_participant_registration(text,text) from public, anon, service_role;
grant execute on function public.complete_participant_registration(text,text) to authenticated;

comment on table public.registration_documents is
  'Organization-approved Terms and Privacy document versions. Publish approved text before enabling production registration completion.';
comment on table public.registration_acceptances is
  'Server-recorded participant acceptance timestamps and exact approved document versions.';
comment on table public.parent_email_verification_tokens is
  'Hashed, expiring, single-use parent email verification tokens; raw tokens are returned only to the trusted Edge Function.';


-- A participant who changes their Supabase login email must verify the new address
-- and complete registration again before normal participant access is restored.
create or replace function public.reset_registration_after_auth_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email or new.email_confirmed_at is null then
    update public.profiles set registration_completed_at = null where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.reset_registration_after_auth_email_change() from public, anon, authenticated, service_role;
drop trigger if exists auth_email_change_resets_registration on auth.users;
create trigger auth_email_change_resets_registration
after update of email, email_confirmed_at on auth.users
for each row execute function public.reset_registration_after_auth_email_change();


-- Draft rows are returned only through this ownership-checked RPC. Direct table reads
-- are reserved for completed participants and administrators.
drop policy if exists participants_read_self_or_admin on public.participants;
create policy participants_read_completed_or_admin on public.participants
  for select to authenticated
  using (
    (select public.is_administrator())
    or (
      user_id = (select auth.uid())
      and exists (
        select 1 from public.profiles
        where id = (select auth.uid()) and registration_completed_at is not null
      )
    )
  );

create or replace function public.get_participant_registration_profile()
returns setof public.participants
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.profiles
    where id = v_user_id and role = 'participant'::public.app_role
  ) then raise exception 'Participant role required' using errcode = '42501'; end if;
  return query select * from public.participants where user_id = v_user_id;
end;
$$;

revoke all on function public.get_participant_registration_profile() from public, anon, service_role;
grant execute on function public.get_participant_registration_profile() to authenticated;

drop policy if exists applications_read_own_or_admin on public.applications;
create policy applications_read_completed_participant_or_admin on public.applications
  for select to authenticated
  using (
    (select public.is_administrator())
    or exists (
      select 1
      from public.participants p
      join public.profiles pr on pr.id = p.user_id
      where p.id = applications.participant_id
        and p.user_id = (select auth.uid())
        and pr.registration_completed_at is not null
    )
  );


create or replace function public.invalidate_registration_on_document_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or tg_op = 'DELETE'
    or old.version is distinct from new.version
    or old.content is distinct from new.content
    or old.is_published is distinct from new.is_published then
    update public.profiles set registration_completed_at = null
    where registration_completed_at is not null;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$;

revoke all on function public.invalidate_registration_on_document_change() from public, anon, authenticated, service_role;
drop trigger if exists registration_documents_invalidate_acceptance on public.registration_documents;
create trigger registration_documents_invalidate_acceptance
after insert or update or delete on public.registration_documents
for each row execute function public.invalidate_registration_on_document_change();

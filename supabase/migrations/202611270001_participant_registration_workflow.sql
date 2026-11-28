-- Four-step participant onboarding with guardian verification and versioned consent.
-- All participant writes are performed through narrow SECURITY DEFINER RPCs.
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('terms', 'privacy')),
  version text not null,
  title text not null,
  content text not null,
  is_current boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_type, version)
);

create unique index legal_documents_one_current_per_type
  on public.legal_documents (document_type) where is_current;

insert into public.legal_documents (document_type, version, title, content, is_current)
values
  ('terms', '0.1-placeholder', 'Terms and Conditions — placeholder',
   'ORGANIZATION PLACEHOLDER: Approved Terms and Conditions have not yet been supplied. Replace this document with the organization-approved text and a new version before production use.',
   true),
  ('privacy', '0.1-placeholder', 'Privacy Policy — placeholder',
   'ORGANIZATION PLACEHOLDER: The approved Privacy Policy has not yet been supplied. Replace this document with the organization-approved text and a new version before production use.',
   true);

create table public.participant_registrations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  first_name text,
  last_name text,
  age smallint,
  biography text,
  school text,
  grade text,
  teacher_name text,
  guardian_full_name text,
  guardian_phone text,
  guardian_email text,
  guardian_verified_at timestamptz,
  guardian_verified_email text,
  step_1_completed_at timestamptz,
  step_2_completed_at timestamptz,
  step_3_completed_at timestamptz,
  step_4_completed_at timestamptz,
  terms_version text,
  terms_accepted_at timestamptz,
  privacy_version text,
  privacy_accepted_at timestamptz,
  parental_consent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_registrations_age_positive check (age is null or age > 0),
  constraint participant_registrations_completed_consent check (
    completed_at is null or (
      guardian_verified_at is not null
      and parental_consent_at is not null
      and terms_accepted_at is not null
      and privacy_accepted_at is not null
    )
  )
);

create index participant_registrations_incomplete_idx
  on public.participant_registrations (updated_at desc)
  where completed_at is null;
create index legal_documents_current_idx
  on public.legal_documents (document_type, is_current);

create table public.guardian_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  guardian_email text not null,
  token_hash text not null unique check (length(token_hash) = 64),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index guardian_verification_tokens_user_created_idx
  on public.guardian_verification_tokens (user_id, created_at desc);

alter table public.legal_documents enable row level security;
alter table public.participant_registrations enable row level security;
alter table public.guardian_verification_tokens enable row level security;

grant select on public.legal_documents to anon, authenticated;
create policy legal_documents_read_current on public.legal_documents
  for select to anon, authenticated using (is_current or (select public.is_administrator()));

revoke all on public.participant_registrations from anon, authenticated;
grant select on public.participant_registrations to authenticated;
create policy participant_registrations_read_self_or_admin on public.participant_registrations
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_administrator()));

revoke all on public.guardian_verification_tokens from public, anon, authenticated;
grant all on public.guardian_verification_tokens to service_role;
create policy guardian_tokens_service_only on public.guardian_verification_tokens
  for all to service_role using (true) with check (true);

drop policy if exists participants_insert_self on public.participants;
drop policy if exists participants_update_self_or_admin on public.participants;
create policy participants_admin_insert on public.participants for insert to authenticated
  with check ((select public.is_administrator()));
create policy participants_admin_update on public.participants for update to authenticated
  using ((select public.is_administrator()))
  with check ((select public.is_administrator()));

create or replace function public.save_participant_registration_step(
  p_step integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_registration public.participant_registrations%rowtype;
  v_email text;
  v_terms_version text;
  v_privacy_version text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_step not between 1 and 4 or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid registration step' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_user_id and role = 'participant'::public.app_role
  ) then
    raise exception 'Participant account required' using errcode = '42501';
  end if;

  insert into public.participant_registrations (user_id)
  values (v_user_id) on conflict (user_id) do nothing;
  select * into v_registration
  from public.participant_registrations
  where user_id = v_user_id for update;

  if p_step > 1 and v_registration.step_1_completed_at is null then
    raise exception 'Complete personal information first' using errcode = '23514';
  end if;
  if p_step > 2 and v_registration.step_2_completed_at is null then
    raise exception 'Complete education information first' using errcode = '23514';
  end if;
  if p_step > 3 and v_registration.step_3_completed_at is null then
    raise exception 'Complete guardian information first' using errcode = '23514';
  end if;

  if p_step = 1 then
    if length(btrim(coalesce(p_payload->>'firstName',''))) < 2
      or length(btrim(coalesce(p_payload->>'lastName',''))) < 2
      or coalesce((p_payload->>'age')::integer, 0) < 1
      or length(btrim(coalesce(p_payload->>'biography',''))) < 10 then
      raise exception 'Personal information is incomplete or invalid' using errcode = '23514';
    end if;
    update public.participant_registrations set
      first_name = btrim(p_payload->>'firstName'),
      last_name = btrim(p_payload->>'lastName'),
      age = (p_payload->>'age')::smallint,
      biography = btrim(p_payload->>'biography'),
      step_1_completed_at = now(),
      updated_at = now()
    where user_id = v_user_id;

  elsif p_step = 2 then
    if length(btrim(coalesce(p_payload->>'school',''))) < 2
      or length(btrim(coalesce(p_payload->>'grade',''))) < 1
      or length(btrim(coalesce(p_payload->>'teacherName',''))) < 2 then
      raise exception 'Education information is incomplete or invalid' using errcode = '23514';
    end if;
    update public.participant_registrations set
      school = btrim(p_payload->>'school'),
      grade = btrim(p_payload->>'grade'),
      teacher_name = btrim(p_payload->>'teacherName'),
      step_2_completed_at = now(),
      updated_at = now()
    where user_id = v_user_id;

  elsif p_step = 3 then
    v_email := lower(btrim(coalesce(p_payload->>'guardianEmail','')));
    if length(btrim(coalesce(p_payload->>'guardianFullName',''))) < 3
      or length(btrim(coalesce(p_payload->>'guardianPhone',''))) < 6
      or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
      raise exception 'Guardian information is incomplete or invalid' using errcode = '23514';
    end if;
    update public.participant_registrations set
      guardian_full_name = btrim(p_payload->>'guardianFullName'),
      guardian_phone = btrim(p_payload->>'guardianPhone'),
      guardian_email = v_email,
      guardian_verified_at = case when guardian_email is distinct from v_email then null else guardian_verified_at end,
      guardian_verified_email = case when guardian_email is distinct from v_email then null else guardian_verified_email end,
      step_3_completed_at = now(),
      step_4_completed_at = case when guardian_email is distinct from v_email then null else step_4_completed_at end,
      terms_version = case when guardian_email is distinct from v_email then null else terms_version end,
      terms_accepted_at = case when guardian_email is distinct from v_email then null else terms_accepted_at end,
      privacy_version = case when guardian_email is distinct from v_email then null else privacy_version end,
      privacy_accepted_at = case when guardian_email is distinct from v_email then null else privacy_accepted_at end,
      parental_consent_at = case when guardian_email is distinct from v_email then null else parental_consent_at end,
      completed_at = null,
      updated_at = now()
    where user_id = v_user_id;

  else
    if v_registration.guardian_verified_at is null
      or v_registration.guardian_verified_email is distinct from v_registration.guardian_email then
      raise exception 'Guardian email must be verified before consent' using errcode = '23514';
    end if;
    if coalesce((p_payload->>'termsAccepted')::boolean, false) is not true
      or coalesce((p_payload->>'privacyAccepted')::boolean, false) is not true
      or coalesce((p_payload->>'parentalConsent')::boolean, false) is not true then
      raise exception 'All legal agreements and parental consent are required' using errcode = '23514';
    end if;
    select version into v_terms_version from public.legal_documents
      where document_type = 'terms' and is_current;
    select version into v_privacy_version from public.legal_documents
      where document_type = 'privacy' and is_current;
    if v_terms_version is null or v_privacy_version is null
      or p_payload->>'termsVersion' is distinct from v_terms_version
      or p_payload->>'privacyVersion' is distinct from v_privacy_version then
      raise exception 'Legal documents changed; review the current versions' using errcode = '23514';
    end if;
    update public.participant_registrations set
      terms_version = v_terms_version,
      terms_accepted_at = now(),
      privacy_version = v_privacy_version,
      privacy_accepted_at = now(),
      parental_consent_at = now(),
      step_4_completed_at = now(),
      updated_at = now()
    where user_id = v_user_id;
  end if;

  select * into v_registration from public.participant_registrations
    where user_id = v_user_id;
  return to_jsonb(v_registration) || jsonb_build_object(
    'next_step',
    case
      when v_registration.step_1_completed_at is null then 1
      when v_registration.step_2_completed_at is null then 2
      when v_registration.step_3_completed_at is null then 3
      when v_registration.step_4_completed_at is null then 4
      else 5
    end
  );
end;
$$;

create or replace function public.complete_participant_registration()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_registration public.participant_registrations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into v_registration from public.participant_registrations
    where user_id = v_user_id for update;
  if not found
    or v_registration.step_1_completed_at is null
    or v_registration.step_2_completed_at is null
    or v_registration.step_3_completed_at is null
    or v_registration.step_4_completed_at is null
    or v_registration.guardian_verified_at is null
    or v_registration.guardian_verified_email is distinct from v_registration.guardian_email
    or v_registration.terms_accepted_at is null
    or v_registration.privacy_accepted_at is null
    or v_registration.parental_consent_at is null
    or not exists (select 1 from public.legal_documents
      where document_type = 'terms' and is_current and version = v_registration.terms_version)
    or not exists (select 1 from public.legal_documents
      where document_type = 'privacy' and is_current and version = v_registration.privacy_version) then
    raise exception 'Registration requirements are not complete' using errcode = '23514';
  end if;

  insert into public.participants (
    user_id, first_name, last_name, age, biography, school, grade, teacher_name,
    parent_contact_name, parent_contact_phone, parent_contact_email
  ) values (
    v_user_id, v_registration.first_name, v_registration.last_name, v_registration.age,
    v_registration.biography, v_registration.school, v_registration.grade,
    v_registration.teacher_name, v_registration.guardian_full_name,
    v_registration.guardian_phone, v_registration.guardian_email
  )
  on conflict (user_id) do update set
    first_name = excluded.first_name, last_name = excluded.last_name, age = excluded.age,
    biography = excluded.biography, school = excluded.school, grade = excluded.grade,
    teacher_name = excluded.teacher_name, parent_contact_name = excluded.parent_contact_name,
    parent_contact_phone = excluded.parent_contact_phone,
    parent_contact_email = excluded.parent_contact_email;

  update public.participant_registrations
  set completed_at = coalesce(completed_at, now()), updated_at = now()
  where user_id = v_user_id;
  return true;
end;
$$;

create or replace function public.confirm_guardian_verification(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.guardian_verification_tokens%rowtype;
begin
  select * into v_token
  from public.guardian_verification_tokens
  where token_hash = p_token_hash and used_at is null and expires_at > now()
  for update;
  if not found then return false; end if;

  update public.participant_registrations
  set guardian_verified_at = now(),
      guardian_verified_email = v_token.guardian_email,
      updated_at = now()
  where user_id = v_token.user_id
    and guardian_email = v_token.guardian_email
    and step_3_completed_at is not null;
  if not found then return false; end if;

  update public.guardian_verification_tokens set used_at = now()
  where id = v_token.id and used_at is null;
  return true;
end;
$$;

revoke all on function public.save_participant_registration_step(integer, jsonb) from public, anon;
revoke all on function public.complete_participant_registration() from public, anon;
revoke all on function public.confirm_guardian_verification(text) from public, anon, authenticated;
grant execute on function public.save_participant_registration_step(integer, jsonb) to authenticated;
grant execute on function public.complete_participant_registration() to authenticated;
grant execute on function public.confirm_guardian_verification(text) to service_role;

create or replace function public.set_registration_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger participant_registrations_set_updated_at
  before update on public.participant_registrations
  for each row execute function public.set_registration_updated_at();

comment on table public.participant_registrations is
  'Private participant onboarding state. Writes are limited to validated registration RPCs.';
comment on table public.guardian_verification_tokens is
  'Single-use hashed guardian verification tokens. Service-role access only.';
comment on table public.legal_documents is
  'Versioned legal documents. Initial contents are explicitly unapproved organization placeholders.';

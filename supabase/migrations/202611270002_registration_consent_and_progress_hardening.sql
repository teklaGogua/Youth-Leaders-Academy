-- Re-saving an earlier step invalidates downstream completion. A completed registration is immutable.
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
  if p_step not between 1 and 4 or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
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

  if v_registration.completed_at is not null then
    raise exception 'Completed registration cannot be edited' using errcode = '23514';
  end if;
  if p_step > 1 and v_registration.step_1_completed_at is null then
    raise exception 'Complete personal information first' using errcode = '23514';
  end if;
  if p_step > 2 and v_registration.step_2_completed_at is null then
    raise exception 'Complete education information first' using errcode = '23514';
  end if;
  if p_step > 3 and (
    v_registration.step_3_completed_at is null
    or v_registration.guardian_verified_at is null
    or v_registration.guardian_verified_email is distinct from v_registration.guardian_email
    or v_registration.parental_consent_at is null
  ) then
    raise exception 'Guardian email verification and explicit consent are both required' using errcode = '23514';
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
      school = null, grade = null, teacher_name = null,
      guardian_full_name = null, guardian_phone = null, guardian_email = null,
      guardian_verified_at = null, guardian_verified_email = null,
      parental_consent_at = null,
      step_1_completed_at = now(), step_2_completed_at = null,
      step_3_completed_at = null, step_4_completed_at = null,
      terms_version = null, terms_accepted_at = null,
      privacy_version = null, privacy_accepted_at = null,
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
      guardian_full_name = null, guardian_phone = null, guardian_email = null,
      guardian_verified_at = null, guardian_verified_email = null,
      parental_consent_at = null,
      step_2_completed_at = now(), step_3_completed_at = null,
      step_4_completed_at = null, terms_version = null, terms_accepted_at = null,
      privacy_version = null, privacy_accepted_at = null, updated_at = now()
    where user_id = v_user_id;

  elsif p_step = 3 then
    v_email := lower(btrim(coalesce(p_payload->>'guardianEmail','')));
    if length(btrim(coalesce(p_payload->>'guardianFullName',''))) < 3
      or length(btrim(coalesce(p_payload->>'guardianPhone',''))) < 6
      or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
      raise exception 'Guardian information is incomplete or invalid' using errcode = '23514';
    end if;
    update public.participant_registrations set
      guardian_verified_at = case
        when guardian_full_name is distinct from btrim(p_payload->>'guardianFullName')
          or guardian_phone is distinct from btrim(p_payload->>'guardianPhone')
          or guardian_email is distinct from v_email then null else guardian_verified_at end,
      guardian_verified_email = case
        when guardian_full_name is distinct from btrim(p_payload->>'guardianFullName')
          or guardian_phone is distinct from btrim(p_payload->>'guardianPhone')
          or guardian_email is distinct from v_email then null else guardian_verified_email end,
      parental_consent_at = case
        when guardian_full_name is distinct from btrim(p_payload->>'guardianFullName')
          or guardian_phone is distinct from btrim(p_payload->>'guardianPhone')
          or guardian_email is distinct from v_email then null else parental_consent_at end,
      guardian_full_name = btrim(p_payload->>'guardianFullName'),
      guardian_phone = btrim(p_payload->>'guardianPhone'),
      guardian_email = v_email,
      step_3_completed_at = now(), step_4_completed_at = null,
      terms_version = null, terms_accepted_at = null,
      privacy_version = null, privacy_accepted_at = null,
      updated_at = now()
    where user_id = v_user_id;

  else
    if v_registration.guardian_verified_at is null
      or v_registration.guardian_verified_email is distinct from v_registration.guardian_email
      or v_registration.parental_consent_at is null then
      raise exception 'Guardian email verification and explicit consent are both required' using errcode = '23514';
    end if;
    if coalesce((p_payload->>'termsAccepted')::boolean, false) is not true
      or coalesce((p_payload->>'privacyAccepted')::boolean, false) is not true then
      raise exception 'Both legal agreements must be accepted' using errcode = '23514';
    end if;
    select version into v_terms_version from public.legal_documents
      where document_type = 'terms' and is_current and approved_at is not null;
    select version into v_privacy_version from public.legal_documents
      where document_type = 'privacy' and is_current and approved_at is not null;
    if v_terms_version is null or v_privacy_version is null
      or p_payload->>'termsVersion' is distinct from v_terms_version
      or p_payload->>'privacyVersion' is distinct from v_privacy_version then
      raise exception 'Approved legal documents are not available or their versions changed' using errcode = '23514';
    end if;
    update public.participant_registrations set
      terms_version = v_terms_version, terms_accepted_at = now(),
      privacy_version = v_privacy_version, privacy_accepted_at = now(),
      step_4_completed_at = now(), updated_at = now()
    where user_id = v_user_id;
  end if;

  select * into v_registration from public.participant_registrations
    where user_id = v_user_id;
  return to_jsonb(v_registration) || jsonb_build_object(
    'next_step',
    case
      when v_registration.step_1_completed_at is null then 1
      when v_registration.step_2_completed_at is null then 2
      when v_registration.step_3_completed_at is null
        or v_registration.guardian_verified_at is null
        or v_registration.guardian_verified_email is distinct from v_registration.guardian_email
        or v_registration.parental_consent_at is null then 3
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
    or v_registration.completed_at is not null
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
      where document_type = 'terms' and is_current and approved_at is not null
        and version = v_registration.terms_version)
    or not exists (select 1 from public.legal_documents
      where document_type = 'privacy' and is_current and approved_at is not null
        and version = v_registration.privacy_version) then
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
  set completed_at = now(), updated_at = now()
  where user_id = v_user_id;
  return true;
end;
$$;

drop function if exists public.confirm_guardian_verification(text);
create function public.confirm_guardian_verification(
  p_token_hash text,
  p_parental_consent boolean default false
)
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
  set guardian_verified_at = coalesce(guardian_verified_at, now()),
      guardian_verified_email = v_token.guardian_email,
      parental_consent_at = case
        when p_parental_consent then coalesce(parental_consent_at, now())
        else parental_consent_at
      end,
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

revoke all on function public.confirm_guardian_verification(text, boolean) from public, anon, authenticated;
grant execute on function public.confirm_guardian_verification(text, boolean) to service_role;

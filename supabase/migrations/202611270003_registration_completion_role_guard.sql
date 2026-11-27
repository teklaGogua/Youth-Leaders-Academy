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
  if not exists (
    select 1 from public.profiles
    where id = v_user_id and role = 'participant'::public.app_role
  ) then
    raise exception 'Participant account required' using errcode = '42501';
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

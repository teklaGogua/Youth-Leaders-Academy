-- The guardian's consent declaration is itself an organization-approved, versioned document.
alter table public.legal_documents
  drop constraint legal_documents_document_type_check;
alter table public.legal_documents
  add constraint legal_documents_document_type_check
  check (document_type in ('terms', 'privacy', 'guardian_consent'));

insert into public.legal_documents (
  document_type, version, title, content, is_current
) values (
  'guardian_consent',
  '0.1-placeholder',
  'Parent / Guardian Consent Declaration — placeholder',
  'ORGANIZATION PLACEHOLDER: The approved parent/guardian consent declaration has not been supplied. Replace this text with the organization-approved declaration, publish a new version and set approved_at before requesting consent.',
  true
);

alter table public.participant_registrations
  add column parental_consent_version text;
alter table public.guardian_verification_tokens
  add column guardian_consent_version text;

create or replace function public.confirm_guardian_consent(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.guardian_verification_tokens%rowtype;
begin
  select * into v_token from public.guardian_verification_tokens
  where token_hash = p_token_hash and purpose = 'consent'
    and used_at is null and expires_at > now()
  for update;
  if not found then return false; end if;

  update public.participant_registrations r
  set parental_consent_at = now(),
      parental_consent_terms_version = v_token.terms_version,
      parental_consent_privacy_version = v_token.privacy_version,
      parental_consent_version = v_token.guardian_consent_version,
      step_4_completed_at = now(),
      updated_at = now()
  where r.user_id = v_token.user_id
    and r.guardian_email = v_token.guardian_email
    and r.guardian_verified_at is not null
    and r.guardian_verified_email = r.guardian_email
    and r.terms_accepted_at is not null
    and r.privacy_accepted_at is not null
    and r.terms_version = v_token.terms_version
    and r.privacy_version = v_token.privacy_version
    and v_token.guardian_consent_version is not null
    and exists (select 1 from public.legal_documents d
      where d.document_type = 'terms' and d.is_current and d.approved_at is not null
        and d.version = v_token.terms_version)
    and exists (select 1 from public.legal_documents d
      where d.document_type = 'privacy' and d.is_current and d.approved_at is not null
        and d.version = v_token.privacy_version)
    and exists (select 1 from public.legal_documents d
      where d.document_type = 'guardian_consent' and d.is_current
        and d.approved_at is not null and d.version = v_token.guardian_consent_version);
  if not found then return false; end if;

  update public.guardian_verification_tokens set used_at = now()
  where id = v_token.id and used_at is null;
  return true;
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
  if not exists (select 1 from public.profiles
    where id = v_user_id and role = 'participant'::public.app_role) then
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
    or v_registration.parental_consent_terms_version is distinct from v_registration.terms_version
    or v_registration.parental_consent_privacy_version is distinct from v_registration.privacy_version
    or v_registration.parental_consent_version is null
    or not exists (select 1 from public.legal_documents
      where document_type = 'terms' and is_current and approved_at is not null
        and version = v_registration.terms_version)
    or not exists (select 1 from public.legal_documents
      where document_type = 'privacy' and is_current and approved_at is not null
        and version = v_registration.privacy_version)
    or not exists (select 1 from public.legal_documents
      where document_type = 'guardian_consent' and is_current and approved_at is not null
        and version = v_registration.parental_consent_version) then
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

create or replace function public.invalidate_incomplete_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.participant_registrations
  set terms_version = null, terms_accepted_at = null,
      privacy_version = null, privacy_accepted_at = null,
      parental_consent_at = null, parental_consent_terms_version = null,
      parental_consent_privacy_version = null, parental_consent_version = null,
      step_4_completed_at = null, updated_at = now()
  where completed_at is null;
  return null;
end;
$$;

revoke all on function public.confirm_guardian_consent(text) from public, anon, authenticated;
grant execute on function public.confirm_guardian_consent(text) to service_role;

comment on column public.participant_registrations.parental_consent_version is
  'Version of the organization-approved guardian consent declaration explicitly accepted by the guardian.';

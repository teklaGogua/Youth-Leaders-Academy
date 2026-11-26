-- Require an explicit acceptance attestation in addition to current document versions.
-- Keep the previous migration immutable: replace only its completion RPC contract.

drop function if exists public.complete_participant_registration(text, text);

create function public.complete_participant_registration(
  p_terms_version text,
  p_privacy_version text,
  p_terms_accepted boolean,
  p_privacy_accepted boolean
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
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select role into v_role from public.profiles where id = v_user_id for update;
  if v_role is distinct from 'participant'::public.app_role then
    raise exception 'Participant role required' using errcode = '42501';
  end if;

  select email_confirmed_at into v_confirmed_at from auth.users where id = v_user_id;
  if v_confirmed_at is null then
    raise exception 'Participant email is not verified' using errcode = '42501';
  end if;

  if p_terms_accepted is distinct from true or p_privacy_accepted is distinct from true then
    raise exception 'Explicit Terms and Privacy acceptance is required' using errcode = '22023';
  end if;

  select * into v_participant
  from public.participants
  where user_id = v_user_id
  for update;

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
    raise exception 'Required profile fields and parent email verification are incomplete'
      using errcode = '22023';
  end if;

  select version into v_terms_version
  from public.registration_documents
  where slug = 'terms' and is_published;
  select version into v_privacy_version
  from public.registration_documents
  where slug = 'privacy' and is_published;

  if v_terms_version is null or v_privacy_version is null
    or p_terms_version is distinct from v_terms_version
    or p_privacy_version is distinct from v_privacy_version then
    raise exception 'Approved Terms and Privacy documents must be published and accepted'
      using errcode = '22023';
  end if;

  insert into public.registration_acceptances(user_id,terms_version,privacy_version,accepted_at)
  values (v_user_id,v_terms_version,v_privacy_version,v_accepted_at)
  on conflict (user_id) do update set
    terms_version = excluded.terms_version,
    privacy_version = excluded.privacy_version,
    accepted_at = excluded.accepted_at;

  update public.profiles
  set registration_completed_at = v_accepted_at
  where id = v_user_id;

  return v_accepted_at;
end;
$$;

revoke all on function public.complete_participant_registration(text,text,boolean,boolean)
  from public, anon, service_role;
grant execute on function public.complete_participant_registration(text,text,boolean,boolean)
  to authenticated;

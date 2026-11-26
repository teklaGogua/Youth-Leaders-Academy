-- Phase 6: participant-owned application submission through a narrow transaction.
-- Existing migrations are immutable. This function is the only participant application write path.

create or replace function public.submit_competition_application(
  p_competition_id uuid,
  p_participant jsonb
)
returns table (application_id uuid, participant_id uuid, application_status public.application_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_participant_id uuid;
  v_application_id uuid;
  v_status public.application_status;
  v_competition public.competitions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_competition_id is null or p_participant is null
    or jsonb_typeof(p_participant) <> 'object' then
    raise exception 'Invalid application details' using errcode = '22023';
  end if;

  select * into v_competition
  from public.competitions
  where id = p_competition_id
  for update;

  if not found or v_competition.status <> 'published' then
    raise exception 'Competition is not available' using errcode = 'P0002';
  end if;

  if v_competition.registration_start is not null
    and statement_timestamp() < v_competition.registration_start then
    raise exception 'Registration has not opened' using errcode = 'P0001';
  end if;

  if v_competition.registration_end is not null
    and statement_timestamp() > v_competition.registration_end then
    raise exception 'Registration has closed' using errcode = 'P0001';
  end if;

  insert into public.participants (
    user_id, first_name, last_name, age, biography, school, grade,
    teacher_name, parent_contact_name, parent_contact_phone, parent_contact_email
  )
  values (
    v_user_id,
    nullif(btrim(p_participant ->> 'first_name'), ''),
    nullif(btrim(p_participant ->> 'last_name'), ''),
    nullif(p_participant ->> 'age', '')::smallint,
    nullif(btrim(p_participant ->> 'biography'), ''),
    nullif(btrim(p_participant ->> 'school'), ''),
    nullif(btrim(p_participant ->> 'grade'), ''),
    nullif(btrim(p_participant ->> 'teacher_name'), ''),
    nullif(btrim(p_participant ->> 'parent_contact_name'), ''),
    nullif(btrim(p_participant ->> 'parent_contact_phone'), ''),
    nullif(btrim(p_participant ->> 'parent_contact_email'), '')
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
    parent_contact_email = excluded.parent_contact_email
  returning id into v_participant_id;

  insert into public.applications (participant_id, competition_id)
  values (v_participant_id, p_competition_id)
  returning id, status into v_application_id, v_status;

  return query select v_application_id, v_participant_id, v_status;
exception
  when unique_violation then
    raise exception 'An application already exists for this competition'
      using errcode = '23505';
end;
$$;

revoke all on function public.submit_competition_application(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_competition_application(uuid, jsonb)
  to authenticated;

comment on function public.submit_competition_application(uuid, jsonb) is
  'Atomically upserts the authenticated caller participant details and creates one application for an open published competition. Caller cannot select participant_id or application status.';

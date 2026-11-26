-- Youth Leaders Academy — Phase 6 hosted demo setup
-- Run only in the dedicated DEVELOPMENT/DEMO Supabase project, never production.
-- Review the target project ref before executing. This script creates no Auth users.
-- It installs the exact submission function from migration
-- 202611270001_competition_application_submission.sql and one synthetic competition.
-- The migration file remains the source of truth; keep this function body in sync.

-- Phase 6: participant-owned application submission through a narrow transaction.
-- Existing migrations are immutable. This function is the only participant application write path.

create or replace function public.submit_competition_application(
  p_competition_id uuid,
  p_participant jsonb
)
returns table (
  application_id uuid,
  participant_id uuid,
  application_status public.application_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role public.app_role;
  v_participant_id uuid;
  v_application_id uuid;
  v_status public.application_status;
  v_competition public.competitions%rowtype;
  v_allowed_keys text[] := array[
    'first_name',
    'last_name',
    'age',
    'biography',
    'school',
    'grade',
    'teacher_name',
    'parent_contact_name',
    'parent_contact_phone',
    'parent_contact_email'
  ];
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select role into v_role
  from public.profiles
  where id = v_user_id;

  if v_role is distinct from 'participant'::public.app_role then
    raise exception 'Only participant accounts can submit applications'
      using errcode = '42501';
  end if;

  if p_competition_id is null
    or p_participant is null
    or jsonb_typeof(p_participant) is distinct from 'object' then
    raise exception 'Invalid application details' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_participant) as supplied(key)
    where not (supplied.key = any(v_allowed_keys))
  ) then
    raise exception 'Unexpected application field' using errcode = '22023';
  end if;

  if jsonb_typeof(p_participant -> 'first_name') is distinct from 'string'
    or nullif(btrim(p_participant ->> 'first_name'), '') is null
    or length(btrim(p_participant ->> 'first_name')) > 100
    or jsonb_typeof(p_participant -> 'last_name') is distinct from 'string'
    or nullif(btrim(p_participant ->> 'last_name'), '') is null
    or length(btrim(p_participant ->> 'last_name')) > 100
    or jsonb_typeof(p_participant -> 'school') is distinct from 'string'
    or nullif(btrim(p_participant ->> 'school'), '') is null
    or length(btrim(p_participant ->> 'school')) > 200
    or jsonb_typeof(p_participant -> 'grade') is distinct from 'string'
    or nullif(btrim(p_participant ->> 'grade'), '') is null
    or length(btrim(p_participant ->> 'grade')) > 30
    or jsonb_typeof(p_participant -> 'teacher_name') is distinct from 'string'
    or nullif(btrim(p_participant ->> 'teacher_name'), '') is null
    or length(btrim(p_participant ->> 'teacher_name')) > 150
    or jsonb_typeof(p_participant -> 'parent_contact_name') is distinct from 'string'
    or nullif(btrim(p_participant ->> 'parent_contact_name'), '') is null
    or length(btrim(p_participant ->> 'parent_contact_name')) > 150
    or jsonb_typeof(p_participant -> 'parent_contact_phone') is distinct from 'string'
    or nullif(btrim(p_participant ->> 'parent_contact_phone'), '') is null
    or length(btrim(p_participant ->> 'parent_contact_phone')) > 40
    or jsonb_typeof(p_participant -> 'biography') is distinct from 'string'
    or nullif(btrim(p_participant ->> 'biography'), '') is null
    or length(btrim(p_participant ->> 'biography')) > 500 then
    raise exception 'Required application fields are missing or invalid'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_participant -> 'age') is distinct from 'number'
    or (p_participant ->> 'age') !~ '^[0-9]+$'
    or (p_participant ->> 'age')::numeric < 1
    or (p_participant ->> 'age')::numeric > 32767 then
    raise exception 'Age must be a positive whole number'
      using errcode = '22023';
  end if;

  if p_participant ? 'parent_contact_email'
    and p_participant -> 'parent_contact_email' <> 'null'::jsonb
    and (
      jsonb_typeof(p_participant -> 'parent_contact_email') is distinct from 'string'
      or (
        nullif(btrim(p_participant ->> 'parent_contact_email'), '') is not null
        and (
          length(btrim(p_participant ->> 'parent_contact_email')) > 254
          or btrim(p_participant ->> 'parent_contact_email')
            !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        )
      )
    ) then
    raise exception 'Parent contact email is invalid' using errcode = '22023';
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
    user_id,
    first_name,
    last_name,
    age,
    biography,
    school,
    grade,
    teacher_name,
    parent_contact_name,
    parent_contact_phone,
    parent_contact_email
  )
  values (
    v_user_id,
    nullif(btrim(p_participant ->> 'first_name'), ''),
    nullif(btrim(p_participant ->> 'last_name'), ''),
    (p_participant ->> 'age')::smallint,
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
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Invalid application details' using errcode = '22023';
end;
$$;

revoke all on function public.submit_competition_application(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_competition_application(uuid, jsonb)
  to authenticated;

comment on function public.submit_competition_application(uuid, jsonb) is
  'Atomically validates and upserts the authenticated participant details, then creates one application for an open published competition. Caller cannot select participant_id or application status.';


insert into public.competitions (
  slug,
  title,
  description,
  registration_start,
  registration_end,
  event_date,
  fee,
  status
)
values (
  'phase6-synthetic-demo',
  'სატესტო კონკურსი — Phase 6',
  'სინთეზური სატესტო ჩანაწერი რეგისტრაციისა და მონაწილის დაფის შესამოწმებლად. რეალური ღონისძიება არ არის.',
  now() - interval '1 day',
  now() + interval '30 days',
  current_date + 45,
  0,
  'published'
)
on conflict (slug) do update
set title = excluded.title,
    description = excluded.description,
    registration_start = excluded.registration_start,
    registration_end = excluded.registration_end,
    event_date = excluded.event_date,
    fee = excluded.fee,
    status = excluded.status;

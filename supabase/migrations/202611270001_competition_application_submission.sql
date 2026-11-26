-- Phase 6: persist participant onboarding independently of competition applications.
-- The three previously applied migrations are intentionally unchanged.

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
  v_allowed_keys text[] := array[
    'first_name','last_name','age','biography','school','grade','teacher_name',
    'parent_contact_name','parent_contact_phone','parent_contact_email'
  ];
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role is distinct from 'participant'::public.app_role then
    raise exception 'Only participant accounts can save participant profiles'
      using errcode = '42501';
  end if;

  if p_participant is null or jsonb_typeof(p_participant) is distinct from 'object' then
    raise exception 'Invalid participant profile' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_object_keys(p_participant) supplied(key)
    where not (supplied.key = any(v_allowed_keys))
  ) then
    raise exception 'Unexpected participant field' using errcode = '22023';
  end if;

  if jsonb_typeof(p_participant -> 'first_name') not in ('string', 'null')
    or jsonb_typeof(p_participant -> 'last_name') not in ('string', 'null')
    or jsonb_typeof(p_participant -> 'biography') not in ('string', 'null')
    or jsonb_typeof(p_participant -> 'school') not in ('string', 'null')
    or jsonb_typeof(p_participant -> 'grade') not in ('string', 'null')
    or jsonb_typeof(p_participant -> 'teacher_name') not in ('string', 'null')
    or jsonb_typeof(p_participant -> 'parent_contact_name') not in ('string', 'null')
    or jsonb_typeof(p_participant -> 'parent_contact_phone') not in ('string', 'null')
    or jsonb_typeof(p_participant -> 'parent_contact_email') not in ('string', 'null')
    or (p_participant ? 'age' and jsonb_typeof(p_participant -> 'age') not in ('number', 'null')) then
    raise exception 'Participant fields have invalid types' using errcode = '22023';
  end if;

  if length(coalesce(p_participant ->> 'first_name', '')) > 100
    or length(coalesce(p_participant ->> 'last_name', '')) > 100
    or length(coalesce(p_participant ->> 'biography', '')) > 500
    or length(coalesce(p_participant ->> 'school', '')) > 200
    or length(coalesce(p_participant ->> 'grade', '')) > 30
    or length(coalesce(p_participant ->> 'teacher_name', '')) > 150
    or length(coalesce(p_participant ->> 'parent_contact_name', '')) > 150
    or length(coalesce(p_participant ->> 'parent_contact_phone', '')) > 40
    or length(coalesce(p_participant ->> 'parent_contact_email', '')) > 254 then
    raise exception 'Participant field exceeds its maximum length' using errcode = '22023';
  end if;

  if nullif(btrim(p_participant ->> 'parent_contact_email'), '') is not null
    and btrim(p_participant ->> 'parent_contact_email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Parent contact email is invalid' using errcode = '22023';
  end if;

  if p_participant ? 'age' and p_participant -> 'age' <> 'null'::jsonb
    and ((p_participant ->> 'age') !~ '^[0-9]+$'
      or (p_participant ->> 'age')::numeric < 1
      or (p_participant ->> 'age')::numeric > 32767) then
    raise exception 'Age must be a positive whole number' using errcode = '22023';
  end if;

  if p_complete and (
    nullif(btrim(p_participant ->> 'first_name'), '') is null
    or nullif(btrim(p_participant ->> 'last_name'), '') is null
    or nullif(btrim(p_participant ->> 'biography'), '') is null
    or p_participant -> 'age' is null or p_participant -> 'age' = 'null'::jsonb
    or nullif(btrim(p_participant ->> 'school'), '') is null
    or nullif(btrim(p_participant ->> 'grade'), '') is null
    or nullif(btrim(p_participant ->> 'teacher_name'), '') is null
    or nullif(btrim(p_participant ->> 'parent_contact_name'), '') is null
    or nullif(btrim(p_participant ->> 'parent_contact_phone'), '') is null
  ) then
    raise exception 'Required participant profile fields are missing' using errcode = '22023';
  end if;

  insert into public.participants (
    user_id, first_name, last_name, age, biography, school, grade, teacher_name,
    parent_contact_name, parent_contact_phone, parent_contact_email
  ) values (
    v_user_id,
    nullif(btrim(p_participant ->> 'first_name'), ''),
    nullif(btrim(p_participant ->> 'last_name'), ''),
    case when p_participant -> 'age' is null or p_participant -> 'age' = 'null'::jsonb
      then null else (p_participant ->> 'age')::smallint end,
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
    parent_contact_email = excluded.parent_contact_email;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Invalid participant profile' using errcode = '22023';
end;
$$;

revoke all on function public.save_participant_profile(jsonb, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.save_participant_profile(jsonb, boolean) to authenticated;

comment on function public.save_participant_profile(jsonb, boolean) is
  'Saves the authenticated participant profile only. Partial saves support resumable onboarding; complete saves validate all profile fields. No competition or application rows are created.';

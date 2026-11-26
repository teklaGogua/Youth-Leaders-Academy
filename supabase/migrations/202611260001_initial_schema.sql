-- Initial Youth Leaders Academy schema and row-level authorization.
-- New auth.users records always receive participant role. Signup metadata cannot set roles.

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('participant', 'administrator');
create type public.competition_status as enum ('draft', 'published', 'archived');
create type public.application_status as enum ('registered', 'pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'participant',
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  first_name text,
  last_name text,
  age smallint,
  biography text,
  school text,
  grade text,
  teacher_name text,
  parent_contact_name text,
  parent_contact_phone text,
  parent_contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participants_age_positive check (age is null or age > 0)
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  registration_start timestamptz,
  registration_end timestamptz,
  event_date date,
  fee numeric(10, 2),
  status public.competition_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competitions_fee_nonnegative check (fee is null or fee >= 0),
  constraint competitions_registration_window check (
    registration_start is null or registration_end is null or registration_start <= registration_end
  )
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete restrict,
  competition_id uuid not null references public.competitions (id) on delete restrict,
  status public.application_status not null default 'registered',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_participant_competition_unique unique (participant_id, competition_id)
);

create table public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index participants_user_id_idx on public.participants (user_id);
create index applications_competition_status_created_idx
  on public.applications (competition_id, status, created_at desc);
create index applications_participant_created_idx
  on public.applications (participant_id, created_at desc);
create index faq_entries_published_idx on public.faq_entries (is_published, created_at desc);
create index competitions_publication_idx on public.competitions (status, registration_start);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger participants_set_updated_at before update on public.participants
for each row execute function public.set_updated_at();
create trigger competitions_set_updated_at before update on public.competitions
for each row execute function public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
for each row execute function public.set_updated_at();
create trigger faq_entries_set_updated_at before update on public.faq_entries
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 'participant');
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- SECURITY DEFINER avoids recursive RLS evaluation when policies check the role.
create or replace function public.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'administrator'::public.app_role
  );
$$;

revoke all on function public.is_administrator() from public;
grant execute on function public.is_administrator() to anon, authenticated;

-- Prevent accidental role escalation even if a future grant is added incorrectly.
create or replace function public.prevent_client_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
    and coalesce(auth.role(), '') <> 'service_role'
    and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Profile role can only be changed by a trusted administrator'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_change before update of role on public.profiles
for each row execute function public.prevent_client_role_change();

-- Log operation metadata only; never copy participant details, credentials or tokens.
create or replace function public.write_admin_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_id := old.id;
  else
    affected_id := new.id;
  end if;
  insert into public.audit_logs (actor_id, action, entity_table, entity_id)
  values ((select auth.uid()), tg_op, tg_table_name, affected_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.write_admin_audit_log() from public;

create trigger competitions_audit after insert or update or delete on public.competitions
for each row execute function public.write_admin_audit_log();
create trigger applications_audit after insert or update or delete on public.applications
for each row execute function public.write_admin_audit_log();
create trigger faq_entries_audit after insert or update or delete on public.faq_entries
for each row execute function public.write_admin_audit_log();

alter table public.profiles enable row level security;
alter table public.participants enable row level security;
alter table public.competitions enable row level security;
alter table public.applications enable row level security;
alter table public.faq_entries enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.profiles, public.participants, public.competitions,
  public.applications, public.faq_entries, public.audit_logs from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select, insert, update, delete on public.participants to authenticated;
grant select, insert, update, delete on public.competitions to authenticated;
grant select, insert, update, delete on public.applications to authenticated;
grant select, insert, update, delete on public.faq_entries to authenticated;
grant select on public.audit_logs to authenticated;

grant all on public.profiles, public.participants, public.competitions,
  public.applications, public.faq_entries, public.audit_logs to service_role;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_administrator()));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy participants_read_self_or_admin on public.participants for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_administrator()));
create policy participants_insert_self on public.participants for insert to authenticated
with check (user_id = (select auth.uid()));
create policy participants_update_self_or_admin on public.participants for update to authenticated
using (user_id = (select auth.uid()) or (select public.is_administrator()))
with check (user_id = (select auth.uid()) or (select public.is_administrator()));
create policy participants_delete_admin on public.participants for delete to authenticated
using ((select public.is_administrator()));

create policy competitions_read_published on public.competitions for select to anon, authenticated
using (status = 'published' or (select public.is_administrator()));
create policy competitions_admin_manage on public.competitions for all to authenticated
using ((select public.is_administrator()))
with check ((select public.is_administrator()));

create policy applications_read_own_or_admin on public.applications for select to authenticated
using (
  (select public.is_administrator())
  or exists (
    select 1 from public.participants
    where participants.id = applications.participant_id
      and participants.user_id = (select auth.uid())
  )
);
create policy applications_admin_manage on public.applications for all to authenticated
using ((select public.is_administrator()))
with check ((select public.is_administrator()));

create policy faq_read_published on public.faq_entries for select to anon, authenticated
using (is_published or (select public.is_administrator()));
create policy faq_admin_manage on public.faq_entries for all to authenticated
using ((select public.is_administrator()))
with check ((select public.is_administrator()));

create policy audit_logs_read_admin on public.audit_logs for select to authenticated
using ((select public.is_administrator()));

comment on table public.participants is
  'Provisional participant details. Mandatory fields, age eligibility and parental consent require confirmation.';
comment on table public.applications is
  'Proposed application workflow; participants cannot submit or change applications in this phase.';
comment on column public.applications.status is
  'Provisional states: registered, pending, approved, rejected; confirm with the organization.';
comment on table public.audit_logs is
  'Minimal administrative audit trail. Credentials, tokens and personal row contents are excluded.';

-- Owner-only provisioning after signup and UUID verification:
-- update public.profiles set role = 'administrator' where id = '<verified-auth-user-uuid>';

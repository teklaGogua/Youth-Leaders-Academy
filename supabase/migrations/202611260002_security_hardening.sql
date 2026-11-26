-- Security hardening for the initial Youth Leaders Academy schema.
-- Keep this as a new migration so already-applied schema history is not rewritten.

grant usage on schema public to anon, authenticated, service_role;

-- Public RLS policies require matching SQL SELECT privileges as well.
grant select on public.competitions, public.faq_entries to anon;

-- The UNIQUE constraint already creates an index on participants.user_id.
drop index if exists public.participants_user_id_idx;

-- Keep participant-owned updates limited to participant-editable fields.
-- In particular, a participant cannot change their own id, user_id or timestamps.
revoke all on public.participants from anon, authenticated;
grant select on public.participants to authenticated;
grant insert (
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
) on public.participants to authenticated;
grant update (
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
) on public.participants to authenticated;
grant delete on public.participants to authenticated;

-- Extend the existing minimal audit trail to participant changes and role changes.
create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_id_idx
  on public.audit_logs (actor_id);

create trigger participants_audit
after insert or update or delete on public.participants
for each row execute function public.write_admin_audit_log();

create trigger profiles_role_audit
after update of role on public.profiles
for each row execute function public.write_admin_audit_log();

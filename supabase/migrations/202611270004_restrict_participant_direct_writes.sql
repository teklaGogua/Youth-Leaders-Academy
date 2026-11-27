-- Phase 6: participants must persist profiles through the validated security-definer RPC.
-- Remove self-write RLS paths; retain administrative CRUD.
drop policy if exists participants_insert_self on public.participants;
drop policy if exists participants_update_self_or_admin on public.participants;
-- The preceding migration already creates these admin policies. Recreate them
-- explicitly here so this migration is safe when applied after that history.
drop policy if exists participants_insert_admin on public.participants;
drop policy if exists participants_update_admin on public.participants;
create policy participants_insert_admin on public.participants
  for insert to authenticated with check ((select public.is_administrator()));
create policy participants_update_admin on public.participants
  for update to authenticated using ((select public.is_administrator()))
  with check ((select public.is_administrator()));

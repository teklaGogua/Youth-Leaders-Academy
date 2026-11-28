-- Bind a guardian's affirmative decision to the exact legal versions displayed
-- on the guardian page. A stale review leaves the token available for retry.
create or replace function public.invalidate_guardian_links_after_details_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.guardian_full_name is distinct from new.guardian_full_name
    or old.guardian_phone is distinct from new.guardian_phone
    or old.guardian_email is distinct from new.guardian_email then
    update public.guardian_verification_tokens
    set used_at = now()
    where user_id = new.user_id and used_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists invalidate_guardian_links_after_details_change
  on public.participant_registrations;
create trigger invalidate_guardian_links_after_details_change
  after update of guardian_full_name, guardian_phone, guardian_email
  on public.participant_registrations
  for each row execute function public.invalidate_guardian_links_after_details_change();

-- Remove the old signature so callers cannot bypass reviewed-version binding.
drop function if exists public.confirm_guardian_decision(text, boolean);

create function public.confirm_guardian_decision(
  p_token_hash text,
  p_agree boolean,
  p_terms_version text,
  p_privacy_version text,
  p_guardian_consent_version text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.guardian_verification_tokens%rowtype;
  v_terms_version text;
  v_privacy_version text;
  v_guardian_consent_version text;
begin
  if p_agree is null then return 'invalid'; end if;

  select * into v_token
  from public.guardian_verification_tokens
  where token_hash = p_token_hash and purpose = 'verification'
    and used_at is null and expires_at > now()
  for update;
  if not found then return 'invalid'; end if;

  select version into v_terms_version from public.legal_documents
  where document_type = 'terms' and is_current order by created_at desc limit 1;
  select version into v_privacy_version from public.legal_documents
  where document_type = 'privacy' and is_current order by created_at desc limit 1;
  select version into v_guardian_consent_version from public.legal_documents
  where document_type = 'guardian_consent' and is_current order by created_at desc limit 1;

  if p_agree and (
    v_terms_version is null or v_privacy_version is null or v_guardian_consent_version is null
    or p_terms_version is distinct from v_terms_version
    or p_privacy_version is distinct from v_privacy_version
    or p_guardian_consent_version is distinct from v_guardian_consent_version
  ) then
    return 'stale';
  end if;

  update public.participant_registrations
  set guardian_verified_at = now(),
      guardian_verified_email = v_token.guardian_email,
      parental_consent_at = case when p_agree then now() else null end,
      parental_consent_rejected_at = case when p_agree then null else now() end,
      parental_consent_terms_version = case when p_agree then v_terms_version else null end,
      parental_consent_privacy_version = case when p_agree then v_privacy_version else null end,
      parental_consent_version = case when p_agree then v_guardian_consent_version else null end,
      step_4_completed_at = null,
      completed_at = null,
      updated_at = now()
  where user_id = v_token.user_id and guardian_email = v_token.guardian_email
    and step_3_completed_at is not null;
  if not found then return 'invalid'; end if;

  update public.guardian_verification_tokens set used_at = now()
  where id = v_token.id and used_at is null;
  if not found then return 'invalid'; end if;

  insert into public.audit_logs (actor_id, action, entity_table, entity_id, created_at)
  values (null, case when p_agree then 'guardian_consent_accepted'
    else 'guardian_consent_rejected' end, 'participant_registrations', v_token.user_id, now());
  return 'success';
end;
$$;

revoke all on function public.confirm_guardian_decision(text, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.confirm_guardian_decision(text, boolean, text, text, text)
  to service_role;
revoke all on function public.invalidate_guardian_links_after_details_change()
  from public, anon, authenticated;

-- Explicitly deny direct API execution of the trigger-only audit function.
-- PostgreSQL trigger invocation does not require callers to have EXECUTE privilege.
revoke all on function public.write_admin_audit_log()
  from public, anon, authenticated, service_role;

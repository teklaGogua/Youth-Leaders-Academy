-- Hosted Supabase verification report (read-only).
-- Run in Dashboard SQL Editor. Produces one compact PASS/FAIL row per check.
WITH checks AS (
  SELECT '1 RLS enabled' AS check_name,
    (count(*) = 6 AND bool_and(relrowsecurity)) AS passed,
    format('%s of 6 application tables have RLS enabled', count(*) FILTER (WHERE relrowsecurity)) AS details
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'
    AND c.relname IN ('profiles','participants','competitions','applications','faq_entries','audit_logs')
  UNION ALL
  SELECT '2 Policies present',
    (count(*) >= 13),
    format('%s policies found', count(*))
  FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('profiles','participants','competitions','applications','faq_entries','audit_logs')
  UNION ALL
  SELECT '3 Anonymous table access restricted',
    (NOT has_table_privilege('anon','public.profiles','SELECT')
     AND NOT has_table_privilege('anon','public.participants','SELECT')
     AND NOT has_table_privilege('anon','public.applications','SELECT')
     AND NOT has_table_privilege('anon','public.audit_logs','SELECT')),
    'Anon profile, participant, application and audit access checked'
  UNION ALL
  SELECT '4 Protected column writes denied',
    (NOT has_column_privilege('authenticated','public.profiles','role','UPDATE')
     AND NOT has_column_privilege('authenticated','public.participants','user_id','UPDATE')),
    'Authenticated role/user_id update privileges checked'
  UNION ALL
  SELECT '5 Required triggers present',
    (count(*) >= 11),
    format('%s public-table triggers found', count(*))
  FROM information_schema.triggers WHERE trigger_schema='public'
    AND event_object_table IN ('profiles','participants','competitions','applications','faq_entries')
  UNION ALL
  SELECT '6 Function security',
    (bool_and(prosecdef) FILTER (WHERE proname IN ('is_administrator','write_admin_audit_log','handle_new_user'))
      AND NOT bool_or(prosecdef) FILTER (WHERE proname IN ('prevent_client_role_change','set_updated_at'))),
    'Security-definer and ordinary trigger functions checked'
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND proname IN ('is_administrator','write_admin_audit_log','handle_new_user','prevent_client_role_change','set_updated_at')
  UNION ALL
  SELECT '7 Audit function execution restricted',
    (NOT has_function_privilege('anon','public.write_admin_audit_log()','EXECUTE')
     AND NOT has_function_privilege('authenticated','public.write_admin_audit_log()','EXECUTE')
     AND NOT has_function_privilege('service_role','public.write_admin_audit_log()','EXECUTE')),
    'Direct execution denied for API roles including service_role'
  UNION ALL
  SELECT '8 Data and migration history inspectable',
    (to_regclass('public.participants') IS NOT NULL
     AND to_regclass('public.applications') IS NOT NULL
     AND to_regclass('public.audit_logs') IS NOT NULL),
    format('Counts: participants=%s applications=%s audit_logs=%s; migration history table exists=%s',
      (SELECT count(*) FROM public.participants),
      (SELECT count(*) FROM public.applications),
      (SELECT count(*) FROM public.audit_logs),
      to_regclass('supabase_migrations.schema_migrations') IS NOT NULL)
)
SELECT CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS status,
       check_name, details
FROM checks
ORDER BY check_name;

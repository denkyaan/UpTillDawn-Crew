-- UpTillDawn release preflight: metadata-only. Run in the PRODUCTION
-- Supabase SQL Editor before authorizing any production release. This file
-- does not mutate data, role grants, migration history or existing functions.
-- Do not execute the Main migrations blindly on the divergent production DB.
--
-- PASS requires every required=true row to report passed=true. A release
-- remains BLOCKED while a required row fails; historical migration versions
-- are informational because production used reviewed alignment migrations.
WITH checks(name,required,passed) AS (
  SELECT 'administration_event_draft_rpc', true,
    to_regprocedure('public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)') IS NOT NULL
  UNION ALL
  SELECT 'owner_mode_is_separate_from_head_admin', true,
    coalesce(position('upt_private.is_app_owner' IN pg_get_functiondef(
      to_regprocedure('public.upt_current_effective_role()'))) > 0,false)
  UNION ALL
  SELECT 'owner_mode_supports_three_portals', true,
    coalesce(position('responsible_lead' IN pg_get_functiondef(
      to_regprocedure('public.upt_current_effective_role()'))) > 0,false)
  UNION ALL
  SELECT 'draft_rpc_rejects_unauthenticated', true,
    coalesce(
      NOT has_function_privilege('anon',
        to_regprocedure('public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)'),
        'EXECUTE')
      AND has_function_privilege('authenticated',
        to_regprocedure('public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)'),
        'EXECUTE'), false)
  UNION ALL
  SELECT 'draft_rpc_checks_approval_and_revocation', true,
    coalesce(
      position('account_blocked' IN pg_get_functiondef(
        to_regprocedure('public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)'))) > 0
      AND position('revoked_at' IN pg_get_functiondef(
        to_regprocedure('public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)'))) > 0
      AND position('p_event_id' IN pg_get_functiondef(
        to_regprocedure('public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)'))) > 0,
      false)
  UNION ALL
  SELECT 'owner_mode_rejects_unauthenticated', true,
    coalesce(
      NOT has_function_privilege('anon',
        to_regprocedure('public.upt_current_effective_role()'),'EXECUTE')
      AND has_function_privilege('authenticated',
        to_regprocedure('public.upt_current_effective_role()'),'EXECUTE')
      AND position('auth.uid() is null' IN lower(pg_get_functiondef(
        to_regprocedure('public.upt_current_effective_role()')))) > 0,
      false)
  UNION ALL
  SELECT 'owner_role_mode_setter_present', true,
    coalesce(position('upt_private.is_app_owner' IN pg_get_functiondef(
      to_regprocedure('public.upt_set_admin_role_mode(text)'))) > 0,false)
  UNION ALL
  SELECT 'administration_timesheet_label_rpc', true,
    to_regprocedure('public.upt_administration_timesheet_labels(uuid[])') IS NOT NULL
  UNION ALL
  SELECT 'integrations_have_separate_private_store', true,
    to_regclass('upt_private.integration_connections') IS NOT NULL
  UNION ALL
  SELECT 'integration_permission_rpc', true,
    to_regprocedure('public.upt_can_manage_integrations()') IS NOT NULL
  UNION ALL
  SELECT 'finance_records_exist', true,
    to_regclass('public.admin_financial_documents') IS NOT NULL
    AND to_regclass('public.admin_financial_payments') IS NOT NULL
  UNION ALL
  SELECT 'provider_transaction_records_exist', true,
    to_regclass('public.admin_provider_transactions') IS NOT NULL
    AND to_regclass('public.admin_provider_bank_settlements') IS NOT NULL
  UNION ALL
  SELECT 'attendance_check_in_out_authenticated_only', true,
    coalesce(
      has_function_privilege('authenticated',
        to_regprocedure('public.upt_request_check_in(uuid,uuid,boolean,text,numeric,numeric,numeric,text)'), 'EXECUTE')
      AND NOT has_function_privilege('anon',
        to_regprocedure('public.upt_request_check_in(uuid,uuid,boolean,text,numeric,numeric,numeric,text)'), 'EXECUTE')
      AND has_function_privilege('authenticated',
        to_regprocedure('public.upt_request_check_out(uuid,text)'), 'EXECUTE')
      AND NOT has_function_privilege('anon',
        to_regprocedure('public.upt_request_check_out(uuid,text)'), 'EXECUTE'), false)
  UNION ALL
  SELECT 'verified_self_scoped_session_context', true,
    coalesce(
      has_function_privilege('authenticated',
        to_regprocedure('public.upt_current_session_context()'), 'EXECUTE')
      AND NOT has_function_privilege('anon',
        to_regprocedure('public.upt_current_session_context()'), 'EXECUTE')
      AND NOT (SELECT prosecdef FROM pg_proc
        WHERE oid=to_regprocedure('public.upt_current_session_context()')), false)
  UNION ALL
  SELECT 'chat_read_hotpaths_are_non_mutating', true,
    coalesce((select provolatile = 's' from pg_proc
      where oid=to_regprocedure('public.upt_chat_typing_users(uuid)')),false)
    and coalesce((select provolatile = 's' from pg_proc
      where oid=to_regprocedure('public.upt_chat_channel_summaries()')),false)
  UNION ALL
  SELECT 'main_tip_migration_in_history', false,
    EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE version='20261118112738')
)
SELECT name,required,passed,
  CASE WHEN passed THEN 'PASS'
       WHEN required THEN 'BLOCK RELEASE'
       ELSE 'REVIEW ALIGNMENT' END AS verdict
FROM checks
ORDER BY required DESC,name;

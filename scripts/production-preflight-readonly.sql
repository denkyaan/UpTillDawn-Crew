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
  SELECT 'retired_pre_qr_attendance_closed_and_qr_flow_enabled', true,
    coalesce(
      NOT has_function_privilege('authenticated',
        to_regprocedure('public.upt_request_check_in(uuid,uuid,boolean,text,numeric,numeric,numeric,text)'), 'EXECUTE')
      AND NOT has_function_privilege('anon',
        to_regprocedure('public.upt_request_check_in(uuid,uuid,boolean,text,numeric,numeric,numeric,text)'), 'EXECUTE')
      AND NOT has_function_privilege('authenticated',
        to_regprocedure('public.upt_request_check_out(uuid,text)'), 'EXECUTE')
      AND NOT has_function_privilege('anon',
        to_regprocedure('public.upt_request_check_out(uuid,text)'), 'EXECUTE')
      AND has_function_privilege('authenticated',
        to_regprocedure('public.upt_qr_request(boolean,boolean,text)'), 'EXECUTE')
      AND NOT has_function_privilege('anon',
        to_regprocedure('public.upt_qr_request(boolean,boolean,text)'), 'EXECUTE'), false)
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
  -- Release-blocking security semantics verified on Main. Function existence
  -- is insufficient: older Production revisions exposed caller-selected identities.
  SELECT 'approved_gate_rejects_blocked_accounts', true,
    coalesce(position('account_blocked' in pg_get_functiondef(
      to_regprocedure('public.upt_is_approved()'))) > 0,false)
  UNION ALL
  SELECT 'task_read_and_manage_bind_actor_to_session', true,
    coalesce(position('p_uid = (SELECT auth.uid())' in pg_get_functiondef(
      to_regprocedure('public.upt_can_read_task(uuid,uuid)'))) > 0,false)
    AND coalesce(position('p_uid = (SELECT auth.uid())' in pg_get_functiondef(
      to_regprocedure('public.upt_can_manage_task(uuid,uuid)'))) > 0,false)
  UNION ALL
  SELECT 'driver_supervisor_binds_actor_to_session', true,
    coalesce(position('p_uid = (SELECT auth.uid())' in pg_get_functiondef(
      to_regprocedure('public.upt_is_driver_supervisor(uuid,uuid)'))) > 0,false)
  UNION ALL
  SELECT 'responsible_binds_actor_to_session', true,
    coalesce(position('uid = (SELECT auth.uid())' in pg_get_functiondef(
      to_regprocedure('public.upt_is_responsible(uuid,uuid,uuid)'))) > 0,false)
    AND coalesce(position('upt_is_approved()' in pg_get_functiondef(
      to_regprocedure('public.upt_is_responsible(uuid,uuid,uuid)'))) > 0,false)
  UNION ALL
  SELECT 'successful_admin_login_audit_is_own_account_only', true,
    coalesce(position('v_key IS DISTINCT FROM v_verified_login' in pg_get_functiondef(
      to_regprocedure('public.upt_admin_login_success(text,text,text,text)'))) > 0,false)
    AND coalesce(position('FROM auth.users u' in pg_get_functiondef(
      to_regprocedure('public.upt_admin_login_success(text,text,text,text)'))) > 0,false)
    AND coalesce(position('upt_is_approved()' in pg_get_functiondef(
      to_regprocedure('public.upt_admin_login_success(text,text,text,text)'))) > 0,false)
  UNION ALL
  SELECT 'event_command_revenue_is_admin_only', true,
    coalesce(position('''sales'',CASE WHEN public.upt_is_admin(v_actor)' in pg_get_functiondef(
      to_regprocedure('public.upt_event_command_snapshot(uuid)'))) > 0,false)
    AND coalesce(position('''netCents'',0' in pg_get_functiondef(
      to_regprocedure('public.upt_event_command_snapshot(uuid)'))) > 0,false)
  UNION ALL
  SELECT 'inventory_asset_form_rpc', true,
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.upt_update_inventory_asset_form(uuid,text,text,text,text,timestamptz,integer,integer,text)'),'EXECUTE')
      AND NOT has_function_privilege('anon',to_regprocedure('public.upt_update_inventory_asset_form(uuid,text,text,text,text,timestamptz,integer,integer,text)'),'EXECUTE'),false)
  UNION ALL
  SELECT 'private_work_media_document_types', true,
    EXISTS(SELECT 1 FROM storage.buckets WHERE id='work-media' AND NOT public
      AND allowed_mime_types @> ARRAY[
        'text/plain',
    'text/csv',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]::text[])
    AND EXISTS(
      SELECT 1 FROM pg_catalog.pg_policy p
      WHERE p.polrelid=to_regclass('storage.objects')
        AND p.polname='upt_work_media_document_upload_scope'
        AND NOT p.polpermissive
        AND p.polcmd='a' -- PostgreSQL catalog code for row additions
        AND p.polroles=ARRAY[to_regrole('authenticated')::oid]
        AND p.polwithcheck IS NOT NULL
    )
  UNION ALL
  SELECT 'atomic_responsible_assignment_rpc', true,
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.upt_admin_set_responsible_assignment(uuid,uuid,boolean)'),'EXECUTE')
      AND NOT has_function_privilege('anon',to_regprocedure('public.upt_admin_set_responsible_assignment(uuid,uuid,boolean)'),'EXECUTE'),false)
  UNION ALL
  SELECT 'main_tip_migration_in_history', false,
    EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE version='20261126210000')
)
SELECT name,required,passed,
  CASE WHEN passed THEN 'PASS'
       WHEN required THEN 'BLOCK RELEASE'
       ELSE 'REVIEW ALIGNMENT' END AS verdict
FROM checks
ORDER BY required DESC,name;

-- Supabase advisor hardening.
-- Make RPC-only tables explicitly deny direct client access and add the FK indexes
-- required for efficient cascades/lookups. This does not grant any new table access.

do $$
declare r record;
begin
  for r in select * from (values
    ('public','admin_role_modes'),
    ('public','push_subscriptions'),
    ('public','upload_security_scans'),
    ('upt_private','admin_login_attempts'),
    ('upt_private','admin_login_security_events'),
    ('upt_private','app_owners'),
    ('upt_private','automation_deliveries'),
    ('upt_private','chat_pins'),
    ('upt_private','chat_typing_states'),
    ('upt_private','chat_user_states'),
    ('upt_private','god_data_audit'),
    ('upt_private','god_mode_attempts'),
    ('upt_private','god_mode_config'),
    ('upt_private','god_mode_sessions'),
    ('upt_private','operational_alert_deliveries'),
    ('upt_private','shift_marketplace_claims')
  ) as t(schema_name,table_name)
  loop
    execute format(
      'drop policy if exists advisor_explicit_rpc_only_deny on %I.%I',
      r.schema_name,r.table_name
    );
    execute format(
      'create policy advisor_explicit_rpc_only_deny on %I.%I for all to anon,authenticated using (false) with check (false)',
      r.schema_name,r.table_name
    );
  end loop;
end $$;

create index if not exists chat_pins_message_id_idx
  on upt_private.chat_pins(message_id);

create index if not exists chat_pins_pinned_by_idx
  on upt_private.chat_pins(pinned_by);

create index if not exists chat_typing_states_user_id_idx
  on upt_private.chat_typing_states(user_id);

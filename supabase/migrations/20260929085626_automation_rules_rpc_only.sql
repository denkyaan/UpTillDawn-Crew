drop policy if exists automation_rules_admin_update on public.automation_rules;
revoke update on table public.automation_rules from authenticated;
grant select on table public.automation_rules to authenticated;

comment on function public.upt_save_automation_rule(text,boolean,integer,integer,integer,integer,integer,text[])
is 'Audited admin-only mutation boundary for configurable automation rules.';

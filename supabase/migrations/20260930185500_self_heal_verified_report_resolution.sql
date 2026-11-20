create or replace function public.upt_self_heal_resolve_error_report(p_report uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  update public.user_error_reports
     set status='auto_resolved', maker_action_required=false, maker_action=null, updated_at=now()
   where id=p_report and status in ('processing','needs_maker','maker_working','failed');
  return found;
end;
$$;
revoke all on function public.upt_self_heal_resolve_error_report(uuid) from public, anon, authenticated;
grant execute on function public.upt_self_heal_resolve_error_report(uuid) to service_role;

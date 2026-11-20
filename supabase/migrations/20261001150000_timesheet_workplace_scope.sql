-- Tighten timesheet Responsible access to staff assigned to the Responsible's own workplace.
drop policy if exists timesheets_read on public.timesheets;
create policy timesheets_read on public.timesheets
for select to authenticated
using (
  user_id=(select auth.uid())
  or public.upt_is_admin((select auth.uid()))
  or exists (
    select 1
    from public.responsible_assignments ra
    join public.shifts s
      on s.event_id=ra.event_id
     and s.workplace_id=ra.workplace_id
     and s.user_id=timesheets.user_id
     and s.status<>'cancelled'
     and coalesce(s.response_status,'')<>'declined'
    where ra.event_id=timesheets.event_id
      and ra.user_id=(select auth.uid())
  )
);

create or replace function public.upt_review_timesheet(p_timesheet uuid,p_approve boolean,p_reason text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.timesheets%rowtype;
begin
 select * into v from public.timesheets where id=p_timesheet for update;
 if not found or v.status<>'submitted' then raise exception 'Timesheet is not submitted'; end if;
 if not (
   public.upt_is_admin(auth.uid())
   or exists (
     select 1 from public.responsible_assignments ra
     join public.shifts s on s.event_id=ra.event_id and s.workplace_id=ra.workplace_id
       and s.user_id=v.user_id and s.status<>'cancelled' and coalesce(s.response_status,'')<>'declined'
     where ra.event_id=v.event_id and ra.user_id=auth.uid()
   )
 ) then raise exception 'Not authorized'; end if;
 if v.user_id=auth.uid() then raise exception 'Cannot review own timesheet'; end if;
 if not p_approve and coalesce(length(trim(p_reason)),0)=0 then raise exception 'Rejection reason required'; end if;
 update public.timesheets set status=case when p_approve then 'approved' else 'rejected' end,
   reviewed_at=now(),reviewed_by=auth.uid(),rejection_reason=case when p_approve then null else trim(p_reason) end,updated_at=now()
 where id=p_timesheet;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),case when p_approve then 'TIMESHEET_APPROVED' else 'TIMESHEET_REJECTED' end,'timesheet',p_timesheet,jsonb_build_object('reason',p_reason));
end $$;
revoke all on function public.upt_review_timesheet(uuid,boolean,text) from public,anon;
grant execute on function public.upt_review_timesheet(uuid,boolean,text) to authenticated;
notify pgrst,'reload schema';

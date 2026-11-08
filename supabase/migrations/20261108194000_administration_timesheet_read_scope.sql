-- Administration staff may read operational timesheets without obtaining review, lock or write privileges.
-- Keep the pre-existing workplace-scoped Responsible read boundary intact.
drop policy if exists timesheets_read on public.timesheets;
create policy timesheets_read on public.timesheets
for select to authenticated
using (
  user_id=(select auth.uid())
  or public.upt_is_admin((select auth.uid()))
  or (select public.upt_can_manage_administration())
  or exists (
    select 1 from public.responsible_assignments ra
    join public.shifts s on s.event_id=ra.event_id
      and s.workplace_id=ra.workplace_id
      and s.user_id=timesheets.user_id
      and s.status<>'cancelled'
      and coalesce(s.response_status,'')<>'declined'
    where ra.event_id=timesheets.event_id
      and ra.user_id=(select auth.uid())
  )
);

-- Return only display labels for a bounded set of authorized timesheets.
-- This does not expose the sensitive columns stored in profiles.
create or replace function public.upt_administration_timesheet_labels(p_timesheet_ids uuid[])
returns table(timesheet_id uuid, user_id uuid, crew_name text, event_id uuid, event_name text)
language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.upt_can_manage_administration() then
   raise exception 'Not authorized';
 end if;
 if p_timesheet_ids is null or cardinality(p_timesheet_ids)>100 then
   raise exception 'Invalid timesheet selection';
 end if;
 return query
 select t.id,t.user_id,p.full_name,t.event_id,e.name
 from public.timesheets t
 left join public.profiles p on p.id=t.user_id
 left join public.events e on e.id=t.event_id
 where t.id=any(p_timesheet_ids);
end;
$$;
revoke all on function public.upt_administration_timesheet_labels(uuid[]) from public,anon;
grant execute on function public.upt_administration_timesheet_labels(uuid[]) to authenticated;

create index if not exists timesheets_updated_at_id_idx on public.timesheets(updated_at desc,id desc);
notify pgrst,'reload schema';

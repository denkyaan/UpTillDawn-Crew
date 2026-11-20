-- Forward-only runtime repair for Main environments that skipped 20261110060000.
-- Keep existing timesheet RLS unchanged; restore only bounded private display labels.
-- Preserve administrative read-only timesheet labels while making the
-- authenticated caller gate explicit. This is a forward-only fix for existing
-- databases and for clean historical migration replay; do not rewrite history.
create or replace function public.upt_administration_timesheet_labels(p_timesheet_ids uuid[])
returns table(timesheet_id uuid, user_id uuid, crew_name text, event_id uuid, event_name text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  -- SECURITY DEFINER bypasses underlying table RLS. Both checks are mandatory:
  -- real authenticated identity and authorized Admin/Administration assignment.
  if auth.uid() is null or not public.upt_can_manage_administration() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_timesheet_ids is null or cardinality(p_timesheet_ids) > 100 then
    raise exception 'Invalid timesheet selection' using errcode = '22023';
  end if;
  return query
  select t.id,t.user_id,p.full_name,t.event_id,e.name
  from public.timesheets t
  left join public.profiles p on p.id=t.user_id
  left join public.events e on e.id=t.event_id
  where t.id = any(p_timesheet_ids);
end;
$$;
revoke all on function public.upt_administration_timesheet_labels(uuid[]) from public, anon, authenticated;
grant execute on function public.upt_administration_timesheet_labels(uuid[]) to authenticated;
notify pgrst, 'reload schema';

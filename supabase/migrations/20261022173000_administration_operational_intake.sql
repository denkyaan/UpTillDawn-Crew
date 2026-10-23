-- Administrative intake: read-only operational visibility, final approval remains with admin.
-- Deploy through the normal migration pipeline; do not run against a shared production DB manually.
create policy timesheets_administration_read on public.timesheets
for select to authenticated using (public.upt_can_manage_administration());

create policy inventory_items_administration_read on public.inventory_items
for select to authenticated using (public.upt_can_manage_administration());

create policy inventory_movements_administration_read on public.inventory_movements
for select to authenticated using (public.upt_can_manage_administration());

-- Event-driven notification, transactional with timesheet submission.
create or replace function public.upt_notify_administration_timesheet()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
   insert into public.crew_notifications(user_id,title,body,link,kind)
   select distinct a.user_id, 'Werkstaat ingediend', 'Een werkstaat wacht op administratieve controle.',
     '/portals/administration', 'timesheet'
   from public.portal_role_assignments a
   join public.profiles p on p.id = a.user_id
   where a.portal = 'administration'
     and a.approved = true and a.revoked_at is null
     and p.approved = true and p.account_blocked is distinct from true
     and a.user_id <> new.user_id;
 end if;
 return new;
end;
$$;
revoke execute on function public.upt_notify_administration_timesheet() from public, anon, authenticated;
drop trigger if exists upt_notify_administration_timesheet on public.timesheets;
create trigger upt_notify_administration_timesheet after insert or update of status
on public.timesheets for each row execute function public.upt_notify_administration_timesheet();

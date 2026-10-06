create or replace function upt_private.notify_pending_account_admins()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
begin
  if new.approved then
    return new;
  end if;

  insert into public.crew_notifications(user_id,title,body,kind,link)
  select
    p.id,
    'Nieuwe accountgoedkeuring',
    'Nieuw account wacht op goedkeuring: ' || coalesce(nullif(new.full_name,''),'Onbekende gebruiker') || '.',
    'account_approval',
    '/personnel?pending=' || new.id::text
  from public.profiles p
  where p.approved=true
    and p.role='admin'
    and p.id<>new.id;

  return new;
end;
$$;

revoke all on function upt_private.notify_pending_account_admins() from public, anon, authenticated;

drop trigger if exists trg_notify_pending_account_admins on public.profiles;
create trigger trg_notify_pending_account_admins
after insert on public.profiles
for each row
execute function upt_private.notify_pending_account_admins();

insert into public.crew_notifications(user_id,title,body,kind,link)
select
  admin.id,
  'Nieuwe accountgoedkeuring',
  'Nieuw account wacht op goedkeuring: ' || coalesce(nullif(p.full_name,''),'Onbekende gebruiker') || '.',
  'account_approval',
  '/personnel?pending=' || p.id::text
from public.profiles p
cross join public.profiles admin
where p.approved=false
  and coalesce(p.account_blocked,false)=false
  and admin.approved=true
  and admin.role='admin'
  and admin.id<>p.id
  and not exists (
    select 1
    from public.crew_notifications n
    where n.user_id=admin.id
      and n.kind='account_approval'
      and n.link='/personnel?pending=' || p.id::text
  );

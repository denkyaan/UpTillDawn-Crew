create or replace function upt_private.close_account_approval_notifications()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
declare
  v_target uuid;
begin
  v_target:=coalesce(new.id,old.id);

  if tg_op='DELETE'
     or (tg_op='UPDATE' and (new.approved=true or coalesce(new.account_blocked,false)=true)) then
    update public.crew_notifications
    set read_at=coalesce(read_at,now())
    where kind='account_approval'
      and read_at is null
      and link='/personnel?pending=' || v_target::text;
  end if;

  return coalesce(new,old);
end;
$$;

revoke all on function upt_private.close_account_approval_notifications() from public, anon, authenticated;

drop trigger if exists trg_close_account_approval_notifications on public.profiles;
create trigger trg_close_account_approval_notifications
after update of approved,account_blocked or delete on public.profiles
for each row
execute function upt_private.close_account_approval_notifications();

update public.crew_notifications n
set read_at=coalesce(n.read_at,now())
where n.kind='account_approval'
  and n.read_at is null
  and exists(
    select 1
    from public.profiles p
    where n.link='/personnel?pending=' || p.id::text
      and (p.approved=true or coalesce(p.account_blocked,false)=true)
  );

create or replace function upt_private.notify_user_account_approved()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
begin
  if old.approved is distinct from true and new.approved=true then
    insert into public.crew_notifications(user_id,title,body,kind,link)
    values(
      new.id,
      'Account goedgekeurd',
      'Je account is goedgekeurd. Je hebt nu toegang tot Up Till Dawn Crew.',
      'account_approved',
      '/'
    );
  end if;
  return new;
end;
$$;

revoke all on function upt_private.notify_user_account_approved() from public, anon, authenticated;

drop trigger if exists trg_notify_user_account_approved on public.profiles;
create trigger trg_notify_user_account_approved
after update of approved on public.profiles
for each row
execute function upt_private.notify_user_account_approved();

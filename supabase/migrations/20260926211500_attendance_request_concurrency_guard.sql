-- Serialize attendance request creation per user so two devices/tabs cannot
-- create two pending QR requests in the same state transition.

create or replace function upt_private.guard_pending_attendance_request()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'upt_private'
as $$
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  -- Transaction-scoped lock: every pending attendance insert for this user
  -- shares the same key, including requests arriving at the same instant.
  perform pg_advisory_xact_lock(
    hashtextextended('upt-attendance:' || new.user_id::text, 0)
  );

  if tg_table_name = 'check_ins' then
    if exists (
      select 1
      from public.check_ins ci
      where ci.user_id = new.user_id
        and ci.status = 'pending'
    ) then
      raise exception 'Er bestaat al een openstaande check-in aanvraag.'
        using errcode = '23505';
    end if;
  elsif tg_table_name = 'check_outs' then
    if exists (
      select 1
      from public.check_outs co
      where co.user_id = new.user_id
        and co.status = 'pending'
    ) then
      raise exception 'Er bestaat al een openstaande check-out aanvraag.'
        using errcode = '23505';
    end if;
  else
    raise exception 'Unsupported attendance request table';
  end if;

  return new;
end;
$$;

revoke all on function upt_private.guard_pending_attendance_request()
from public, anon, authenticated;

drop trigger if exists check_ins_pending_concurrency_guard on public.check_ins;
create trigger check_ins_pending_concurrency_guard
before insert on public.check_ins
for each row
when (new.status = 'pending')
execute function upt_private.guard_pending_attendance_request();

drop trigger if exists check_outs_pending_concurrency_guard on public.check_outs;
create trigger check_outs_pending_concurrency_guard
before insert on public.check_outs
for each row
when (new.status = 'pending')
execute function upt_private.guard_pending_attendance_request();

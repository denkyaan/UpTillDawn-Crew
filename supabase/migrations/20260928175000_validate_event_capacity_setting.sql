create or replace function upt_private.validate_event_capacity_setting()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
declare
  v_confirmed integer;
begin
  if new.max_joiners is null then
    return new;
  end if;

  select count(*) into v_confirmed
  from public.event_members em
  where em.event_id=new.id;

  if new.max_joiners<v_confirmed then
    raise exception 'Maximum deelnemers kan niet lager zijn dan het huidige aantal bevestigde deelnemers (%).',v_confirmed;
  end if;

  return new;
end;
$$;

revoke all on function upt_private.validate_event_capacity_setting() from public,anon,authenticated;

drop trigger if exists trg_validate_event_capacity_setting on public.events;
create trigger trg_validate_event_capacity_setting
before update of max_joiners on public.events
for each row
execute function upt_private.validate_event_capacity_setting();

notify pgrst,'reload schema';

alter table public.workplaces
  add column if not exists default_shift_start timestamptz,
  add column if not exists default_shift_end timestamptz;

update public.workplaces w
set default_shift_start=coalesce(w.default_shift_start,e.start_at),
    default_shift_end=coalesce(w.default_shift_end,e.end_at)
from public.events e
where e.id=w.event_id
  and (w.default_shift_start is null or w.default_shift_end is null);

alter table public.workplaces
  drop constraint if exists workplaces_default_shift_hours_check;
alter table public.workplaces
  add constraint workplaces_default_shift_hours_check
  check (
    (default_shift_start is null and default_shift_end is null)
    or
    (default_shift_start is not null and default_shift_end is not null and default_shift_end>default_shift_start)
  );

create or replace function upt_private.apply_default_workplace_hours()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if new.default_shift_start is null or new.default_shift_end is null then
    select e.start_at,e.end_at into v_start,v_end
    from public.events e
    where e.id=new.event_id;

    new.default_shift_start:=coalesce(new.default_shift_start,v_start);
    new.default_shift_end:=coalesce(new.default_shift_end,v_end);
  end if;
  return new;
end;
$$;

drop trigger if exists workplaces_default_hours on public.workplaces;
create trigger workplaces_default_hours
before insert on public.workplaces
for each row execute function upt_private.apply_default_workplace_hours();

notify pgrst,'reload schema';

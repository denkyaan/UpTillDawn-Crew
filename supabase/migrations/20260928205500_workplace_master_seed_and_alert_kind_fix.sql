alter table upt_private.operational_alerts
  drop constraint if exists operational_alerts_kind_check;
alter table upt_private.operational_alerts
  add constraint operational_alerts_kind_check
  check (kind in (
    'late-check-in','no-show','understaffed','shift-overrun','missing-checkout','long-break',
    'responsible-missing','briefing-unread','inventory-low','checklist-overdue'
  ));

insert into public.workplace_catalog(name,description,sort_order,is_active,minimum_staff,target_staff,maximum_staff)
select *
from (values
  ('Inkom & Guestlist','Ticket scan, guestlist en artiestenontvangst.',10,true,0,0,null::integer),
  ('Merch','Merchandise verkoop en voorraad.',20,true,0,0,null::integer),
  ('Bar/Toog','Bar, toog en kassawerking.',30,true,0,0,null::integer),
  ('Backstage Management','Backstage, artiestenopvang en hospitality.',40,true,0,0,null::integer),
  ('Allrounder','Flexibele ondersteuning waar nodig.',50,true,0,0,null::integer),
  ('Opbouw','Opbouwteam vóór het evenement.',60,true,0,0,null::integer),
  ('Afbouw','Afbouwteam na het evenement.',70,true,0,0,null::integer)
) as seed(name,description,sort_order,is_active,minimum_staff,target_staff,maximum_staff)
where not exists(
  select 1 from public.workplace_catalog c where lower(c.name)=lower(seed.name)
);

with candidates as (
  select w.id,w.event_id,
    row_number() over(
      partition by w.event_id
      order by case lower(w.name)
        when 'inkom & guestlist' then 0
        when 'ticket scan' then 1
        when 'guest list' then 2
        when 'artists' then 3
        else 9 end,
        w.created_at
    ) as rn
  from public.workplaces w
  where lower(w.name) in ('inkom & guestlist','ticket scan','guest list','artists')
),
catalog as (
  select id,name,description,sort_order,minimum_staff,target_staff,maximum_staff
  from public.workplace_catalog where lower(name)='inkom & guestlist' limit 1
)
update public.workplaces w
set catalog_workplace_id=catalog.id,
    name=catalog.name,
    description=coalesce(w.description,catalog.description),
    sort_order=catalog.sort_order,
    minimum_staff=catalog.minimum_staff,
    target_staff=catalog.target_staff,
    maximum_staff=catalog.maximum_staff,
    is_active=true
from candidates,catalog
where w.id=candidates.id and candidates.rn=1;

with mapping(alias,catalog_name) as (
  values
    ('merch','Merch'),
    ('bar/toog','Bar/Toog'),
    ('backstage management','Backstage Management'),
    ('allrounder','Allrounder'),
    ('setup','Opbouw'),
    ('opbouw','Opbouw'),
    ('breakdown','Afbouw'),
    ('afbouw','Afbouw')
)
update public.workplaces w
set catalog_workplace_id=c.id,
    name=c.name,
    description=coalesce(w.description,c.description),
    sort_order=c.sort_order,
    minimum_staff=c.minimum_staff,
    target_staff=c.target_staff,
    maximum_staff=c.maximum_staff
from mapping m
join public.workplace_catalog c on lower(c.name)=lower(m.catalog_name)
where lower(w.name)=m.alias
  and (
    w.catalog_workplace_id is null
    or w.catalog_workplace_id=c.id
  )
  and not exists(
    select 1 from public.workplaces other
    where other.event_id=w.event_id
      and other.catalog_workplace_id=c.id
      and other.id<>w.id
  );

with candidates as (
  select w.id,w.event_id,
    row_number() over(
      partition by w.event_id
      order by case lower(w.name)
        when 'inkom & guestlist' then 0
        when 'ticket scan' then 1
        when 'guest list' then 2
        when 'artists' then 3
        else 9 end,
        w.created_at
    ) as rn
  from public.workplaces w
  where lower(w.name) in ('inkom & guestlist','ticket scan','guest list','artists')
)
update public.workplaces w
set is_active=false
from candidates
where w.id=candidates.id
  and candidates.rn>1
  and not exists(select 1 from public.shifts s where s.workplace_id=w.id and coalesce(s.status,'')<>'cancelled')
  and not exists(select 1 from public.responsible_assignments r where r.workplace_id=w.id);

insert into public.workplaces(
  event_id,name,description,sort_order,is_active,minimum_staff,target_staff,maximum_staff,catalog_workplace_id
)
select e.id,c.name,c.description,c.sort_order,true,c.minimum_staff,c.target_staff,c.maximum_staff,c.id
from public.events e
cross join public.workplace_catalog c
where e.status<>'archived'
  and c.is_active=true
  and not exists(
    select 1 from public.workplaces w
    where w.event_id=e.id and w.catalog_workplace_id=c.id
  )
on conflict(event_id,name) do nothing;

create or replace function public.upt_seed_event()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $function$
declare
  v_catalog public.workplace_catalog%rowtype;
  v_item public.workplace_catalog_items%rowtype;
  v_workplace uuid;
  v_actor uuid:=auth.uid();
begin
  for v_catalog in
    select * from public.workplace_catalog
    where is_active=true
    order by sort_order,name
  loop
    insert into public.workplaces(
      event_id,name,description,sort_order,is_active,
      minimum_staff,target_staff,maximum_staff,catalog_workplace_id
    )
    values(
      new.id,v_catalog.name,v_catalog.description,v_catalog.sort_order,true,
      v_catalog.minimum_staff,v_catalog.target_staff,v_catalog.maximum_staff,v_catalog.id
    )
    on conflict(event_id,catalog_workplace_id) where catalog_workplace_id is not null
    do update set
      name=excluded.name,
      description=excluded.description,
      sort_order=excluded.sort_order,
      minimum_staff=excluded.minimum_staff,
      target_staff=excluded.target_staff,
      maximum_staff=excluded.maximum_staff,
      is_active=true
    returning id into v_workplace;

    for v_item in
      select * from public.workplace_catalog_items
      where catalog_workplace_id=v_catalog.id and is_active=true
      order by category,name
    loop
      if v_actor is not null then
        insert into public.inventory_items(
          event_id,workplace_id,name,category,total_quantity,available_quantity,
          issued_quantity,damaged_quantity,missing_quantity,is_active,created_by,catalog_item_id
        )
        values(
          new.id,v_workplace,v_item.name,v_item.category,v_item.default_quantity,v_item.default_quantity,
          0,0,0,true,v_actor,v_item.id
        )
        on conflict(event_id,catalog_item_id) where catalog_item_id is not null
        do update set
          name=excluded.name,
          category=excluded.category,
          workplace_id=excluded.workplace_id,
          is_active=true,
          updated_at=now();
      end if;
    end loop;
  end loop;

  insert into public.chat_channels(kind,event_id,name)
  values('event',new.id,new.name||' - algemene chat')
  on conflict do nothing;

  return new;
end;
$function$;

notify pgrst,'reload schema';

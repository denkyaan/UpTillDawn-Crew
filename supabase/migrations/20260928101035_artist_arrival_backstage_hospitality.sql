alter table public.event_guestlist_entries
  add column if not exists arrival_notified_at timestamptz;

create table if not exists public.event_guestlist_settings(
  event_id uuid primary key references public.events(id) on delete cascade,
  backstage_workplace_id uuid references public.workplaces(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists event_guestlist_settings_backstage_idx
on public.event_guestlist_settings(backstage_workplace_id);

alter table public.event_guestlist_settings enable row level security;
revoke all on public.event_guestlist_settings from anon;
revoke insert,update,delete on public.event_guestlist_settings from authenticated;
grant select on public.event_guestlist_settings to authenticated;

drop policy if exists event_guestlist_settings_read on public.event_guestlist_settings;
create policy event_guestlist_settings_read
on public.event_guestlist_settings
for select to authenticated
using(upt_private.guestlist_can_view(event_id,(select auth.uid())));

create table if not exists public.artist_hospitality_items(
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guestlist_entry_id uuid not null references public.event_guestlist_entries(id) on delete cascade,
  item_name text not null,
  quantity integer not null default 1,
  notes text,
  is_done boolean not null default false,
  source text not null default 'manual',
  source_document_name text,
  created_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(length(trim(item_name)) between 1 and 240),
  check(quantity between 1 and 100),
  check(notes is null or length(notes)<=2000),
  check(source in('manual','document','ai')),
  check(source_document_name is null or length(source_document_name)<=255)
);

create unique index if not exists artist_hospitality_item_unique_active
on public.artist_hospitality_items(guestlist_entry_id,lower(trim(item_name)),coalesce(notes,''));

create index if not exists artist_hospitality_items_event_idx
on public.artist_hospitality_items(event_id,guestlist_entry_id,is_done,item_name);

create index if not exists artist_hospitality_items_created_by_idx
on public.artist_hospitality_items(created_by);

create index if not exists artist_hospitality_items_completed_by_idx
on public.artist_hospitality_items(completed_by);

create or replace function upt_private.guestlist_backstage_workplace(p_event uuid)
returns uuid
language sql
stable
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
  select coalesce(
    (
      select s.backstage_workplace_id
      from public.event_guestlist_settings s
      join public.workplaces w on w.id=s.backstage_workplace_id
      where s.event_id=p_event
        and w.event_id=p_event
        and w.is_active=true
      limit 1
    ),
    (
      select w.id
      from public.workplaces w
      where w.event_id=p_event
        and w.is_active=true
        and (
          lower(w.name) like '%backstage%'
          or lower(coalesce(w.map_label,'')) like '%backstage%'
          or lower(coalesce(w.description,'')) like '%backstage%'
        )
      order by w.sort_order,w.created_at
      limit 1
    )
  );
$fn$;

create or replace function upt_private.backstage_can_manage(p_event uuid,p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
  select coalesce(
    p_uid is not null
    and public.upt_is_approved()
    and (
      public.upt_is_admin(p_uid)
      or exists(
        select 1
        from public.responsible_assignments r
        where r.event_id=p_event
          and r.user_id=p_uid
          and r.workplace_id=upt_private.guestlist_backstage_workplace(p_event)
      )
    ),
    false
  );
$fn$;

revoke all on function upt_private.guestlist_backstage_workplace(uuid),
                       upt_private.backstage_can_manage(uuid,uuid)
from public,anon,authenticated;

alter table public.artist_hospitality_items enable row level security;
revoke all on public.artist_hospitality_items from anon;
revoke insert,update,delete on public.artist_hospitality_items from authenticated;
grant select on public.artist_hospitality_items to authenticated;

drop policy if exists artist_hospitality_items_read on public.artist_hospitality_items;
create policy artist_hospitality_items_read
on public.artist_hospitality_items
for select to authenticated
using(
  public.upt_is_admin((select auth.uid()))
  or upt_private.backstage_can_manage(event_id,(select auth.uid()))
);

create or replace function public.upt_guestlist_set_backstage(p_event uuid,p_workplace uuid)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan de backstage-werkplek instellen.';
  end if;

  if not exists(
    select 1 from public.workplaces
    where id=p_workplace and event_id=p_event and is_active=true
  ) then
    raise exception 'Backstage-werkplek niet gevonden.';
  end if;

  insert into public.event_guestlist_settings(event_id,backstage_workplace_id,updated_by,updated_at)
  values(p_event,p_workplace,v_actor,now())
  on conflict(event_id) do update
  set backstage_workplace_id=excluded.backstage_workplace_id,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at;
end
$fn$;

create or replace function public.upt_artist_hospitality_add(
  p_entry uuid,
  p_item text,
  p_quantity integer default 1,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_event uuid;
  v_id uuid;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan artiestenriders beheren.';
  end if;
  if p_item is null or length(trim(p_item)) not between 1 and 240 then raise exception 'Geef een geldige drank of rider-item.'; end if;
  if p_quantity not between 1 and 100 then raise exception 'Aantal moet tussen 1 en 100 liggen.'; end if;
  if length(coalesce(p_notes,''))>2000 then raise exception 'Notitie is te lang.'; end if;

  select event_id into v_event
  from public.event_guestlist_entries
  where id=p_entry and is_active=true and entry_type='artist';
  if v_event is null then raise exception 'Artiest niet gevonden.'; end if;

  insert into public.artist_hospitality_items(
    event_id,guestlist_entry_id,item_name,quantity,notes,source,created_by
  ) values(
    v_event,p_entry,trim(p_item),p_quantity,nullif(trim(coalesce(p_notes,'')),''),'manual',v_actor
  )
  on conflict(guestlist_entry_id,lower(trim(item_name)),coalesce(notes,''))
  do update set quantity=artist_hospitality_items.quantity+excluded.quantity,updated_at=now()
  returning id into v_id;

  return v_id;
end
$fn$;

create or replace function public.upt_artist_hospitality_remove(p_item uuid)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan artiestenriders beheren.';
  end if;
  delete from public.artist_hospitality_items where id=p_item;
  if not found then raise exception 'Rider-item niet gevonden.'; end if;
end
$fn$;

create or replace function public.upt_artist_hospitality_toggle(p_item uuid,p_done boolean)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_event uuid;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  select event_id into v_event from public.artist_hospitality_items where id=p_item;
  if v_event is null then raise exception 'Rider-item niet gevonden.'; end if;
  if not upt_private.backstage_can_manage(v_event,v_actor) then raise exception 'Geen toegang tot de backstage-checklist.'; end if;

  update public.artist_hospitality_items
  set is_done=p_done,
      completed_by=case when p_done then v_actor else null end,
      completed_at=case when p_done then now() else null end,
      updated_at=now()
  where id=p_item;
end
$fn$;

create or replace function upt_private.notify_artist_arrival(
  p_entry uuid,
  p_actor uuid
) returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_event uuid;
  v_name text;
  v_backstage uuid;
  v_channel uuid;
  v_body text;
begin
  select event_id,name into v_event,v_name
  from public.event_guestlist_entries
  where id=p_entry
    and entry_type='artist'
    and is_active=true
  for update;

  if v_event is null then return; end if;

  update public.event_guestlist_entries
  set arrival_notified_at=now(),updated_at=now()
  where id=p_entry and arrival_notified_at is null;

  if not found then return; end if;

  v_backstage:=upt_private.guestlist_backstage_workplace(v_event);
  v_body:='Artiest - '||v_name||', is aangekomen.';

  if v_backstage is not null then
    insert into public.crew_notifications(user_id,title,body,link,kind)
    select
      r.user_id,
      'Artiest aangekomen',
      v_body,
      '/guestlist?event='||v_event::text||'#backstage-artists',
      'artist_arrival'
    from public.responsible_assignments r
    where r.event_id=v_event
      and r.workplace_id=v_backstage;

    select c.id into v_channel
    from public.chat_channels c
    where c.kind='workplace'
      and c.event_id=v_event
      and c.workplace_id=v_backstage
    order by c.created_at
    limit 1;

    if v_channel is not null then
      insert into public.messages(user_id,sender_id,channel_id,body,content)
      values(p_actor,p_actor,v_channel,v_body,v_body);
    end if;
  end if;
end
$fn$;

revoke all on function upt_private.notify_artist_arrival(uuid,uuid) from public,anon,authenticated;

create or replace function public.upt_guestlist_checkin(p_entry uuid,p_delta integer)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_event uuid;
  v_total integer;
  v_checked integer;
  v_next integer;
  v_type text;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_delta not in(-1,1) then raise exception 'Ongeldige check-in wijziging.'; end if;

  select event_id,spots_total,spots_checked_in,entry_type
  into v_event,v_total,v_checked,v_type
  from public.event_guestlist_entries
  where id=p_entry and is_active=true
  for update;
  if not found then raise exception 'Guestlist-item niet gevonden.'; end if;

  if not upt_private.guestlist_can_checkin(v_event,v_actor) then
    raise exception 'Geen toegang om inkom te registreren.';
  end if;

  v_next:=v_checked+p_delta;
  if v_next<0 or v_next>v_total then
    raise exception 'Check-in aantal valt buiten de beschikbare spots.';
  end if;

  update public.event_guestlist_entries
  set spots_checked_in=v_next,
      last_checked_in_by=v_actor,
      last_checked_in_at=now(),
      updated_at=now()
  where id=p_entry;

  insert into upt_private.guestlist_checkin_events(guestlist_entry_id,event_id,user_id,delta)
  values(p_entry,v_event,v_actor,p_delta);

  if p_delta=1 and v_type='artist' and v_checked=0 and v_next>0 then
    perform upt_private.notify_artist_arrival(p_entry,v_actor);
  end if;

  return jsonb_build_object('checkedIn',v_next,'spotsTotal',v_total);
end
$fn$;

create or replace function public.upt_guestlist_import(
  p_event uuid,
  p_entries jsonb,
  p_source_document text default null
) returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_row jsonb;
  v_drink jsonb;
  v_name text;
  v_type text;
  v_spots integer;
  v_notes text;
  v_entry_id uuid;
  v_item text;
  v_qty integer;
  v_item_notes text;
  v_inserted integer:=0;
  v_duplicates integer:=0;
  v_rider_items integer:=0;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan een guestlist importeren.';
  end if;
  if not exists(select 1 from public.events where id=p_event and status<>'archived') then
    raise exception 'Evenement niet gevonden.';
  end if;
  if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)<1 or jsonb_array_length(p_entries)>1000 then
    raise exception 'Import moet tussen 1 en 1000 regels bevatten.';
  end if;
  if length(coalesce(p_source_document,''))>255 then raise exception 'Documentnaam is te lang.'; end if;

  for v_row in select value from jsonb_array_elements(p_entries)
  loop
    v_name:=trim(coalesce(v_row->>'name',''));
    v_type:=lower(trim(coalesce(v_row->>'type','guest')));
    v_spots:=coalesce(nullif(v_row->>'spots','')::integer,1);
    v_notes:=nullif(trim(coalesce(v_row->>'notes','')),'');

    if length(v_name) not between 1 and 240 then raise exception 'Een geïmporteerde naam is ongeldig.'; end if;
    if v_type not in('artist','guest') then raise exception 'Een geïmporteerd type is ongeldig.'; end if;
    if v_spots not between 1 and 100 then raise exception 'Een geïmporteerd aantal spots is ongeldig.'; end if;
    if length(coalesce(v_notes,''))>2000 then raise exception 'Een geïmporteerde notitie is te lang.'; end if;

    select e.id into v_entry_id
    from public.event_guestlist_entries e
    where e.event_id=p_event
      and e.is_active=true
      and lower(trim(e.name))=lower(v_name)
      and e.entry_type=v_type
    limit 1;

    if v_entry_id is null then
      insert into public.event_guestlist_entries(
        event_id,name,entry_type,spots_total,notes,source,source_document_name,created_by
      ) values(
        p_event,v_name,v_type,v_spots,v_notes,'document',
        nullif(left(trim(coalesce(p_source_document,'')),255),''),
        v_actor
      )
      returning id into v_entry_id;
      v_inserted:=v_inserted+1;
    else
      v_duplicates:=v_duplicates+1;
    end if;

    if v_type='artist' and jsonb_typeof(v_row->'drinks')='array' then
      for v_drink in select value from jsonb_array_elements(v_row->'drinks')
      loop
        v_item:=trim(coalesce(v_drink->>'item',''));
        v_qty:=coalesce(nullif(v_drink->>'quantity','')::integer,1);
        v_item_notes:=nullif(trim(coalesce(v_drink->>'notes','')),'');
        if length(v_item) between 1 and 240
           and v_qty between 1 and 100
           and length(coalesce(v_item_notes,''))<=2000 then
          insert into public.artist_hospitality_items(
            event_id,guestlist_entry_id,item_name,quantity,notes,source,source_document_name,created_by
          ) values(
            p_event,v_entry_id,v_item,v_qty,v_item_notes,'document',
            nullif(left(trim(coalesce(p_source_document,'')),255),''),
            v_actor
          )
          on conflict(guestlist_entry_id,lower(trim(item_name)),coalesce(notes,''))
          do update set
            quantity=greatest(artist_hospitality_items.quantity,excluded.quantity),
            source_document_name=coalesce(excluded.source_document_name,artist_hospitality_items.source_document_name),
            updated_at=now();
          v_rider_items:=v_rider_items+1;
        end if;
      end loop;
    end if;

    v_entry_id:=null;
  end loop;

  return jsonb_build_object('inserted',v_inserted,'duplicates',v_duplicates,'riderItems',v_rider_items);
end
$fn$;

revoke all on function public.upt_guestlist_set_backstage(uuid,uuid),
                       public.upt_artist_hospitality_add(uuid,text,integer,text),
                       public.upt_artist_hospitality_remove(uuid),
                       public.upt_artist_hospitality_toggle(uuid,boolean)
from public,anon;

grant execute on function public.upt_guestlist_set_backstage(uuid,uuid),
                          public.upt_artist_hospitality_add(uuid,text,integer,text),
                          public.upt_artist_hospitality_remove(uuid),
                          public.upt_artist_hospitality_toggle(uuid,boolean)
to authenticated;

do $do$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='artist_hospitality_items'
  ) then
    alter publication supabase_realtime add table public.artist_hospitality_items;
  end if;
end
$do$;

notify pgrst,'reload schema';
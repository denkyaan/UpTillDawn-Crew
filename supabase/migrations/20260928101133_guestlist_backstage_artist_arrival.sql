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

create table if not exists public.artist_backstage_checklists(
  guestlist_entry_id uuid primary key references public.event_guestlist_entries(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  drinks text,
  hospitality_notes text,
  drinks_ready boolean not null default false,
  artist_received boolean not null default false,
  drinks_ready_at timestamptz,
  artist_received_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(drinks is null or length(drinks)<=3000),
  check(hospitality_notes is null or length(hospitality_notes)<=3000)
);

create index if not exists artist_backstage_checklists_event_idx
on public.artist_backstage_checklists(event_id,artist_received,drinks_ready);

create or replace function upt_private.guestlist_backstage_workplace(p_event uuid)
returns uuid
language sql
stable
security definer
set search_path='pg_catalog','public'
as $fn$
  select coalesce(
    (select s.backstage_workplace_id from public.event_guestlist_settings s where s.event_id=p_event),
    (
      select w.id
      from public.workplaces w
      where w.event_id=p_event and w.is_active=true and lower(w.name) like '%backstage%'
      order by case when lower(trim(w.name))='backstage' then 0 else 1 end,w.sort_order,w.name
      limit 1
    )
  )
$fn$;

create or replace function upt_private.artist_backstage_can_view(p_event uuid,p_uid uuid default auth.uid())
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
        select 1 from public.responsible_assignments r
        where r.event_id=p_event and r.user_id=p_uid
          and r.workplace_id=upt_private.guestlist_backstage_workplace(p_event)
      )
    ),
    false
  )
$fn$;

revoke all on function upt_private.guestlist_backstage_workplace(uuid),
                       upt_private.artist_backstage_can_view(uuid,uuid)
from public,anon;
grant execute on function upt_private.artist_backstage_can_view(uuid,uuid) to authenticated;

alter table public.event_guestlist_settings enable row level security;
alter table public.artist_backstage_checklists enable row level security;

revoke all on public.event_guestlist_settings,public.artist_backstage_checklists from anon;
revoke insert,update,delete on public.event_guestlist_settings,public.artist_backstage_checklists from authenticated;
grant select on public.event_guestlist_settings,public.artist_backstage_checklists to authenticated;

drop policy if exists event_guestlist_settings_admin_read on public.event_guestlist_settings;
create policy event_guestlist_settings_admin_read
on public.event_guestlist_settings
for select to authenticated
using(public.upt_is_admin((select auth.uid())));

drop policy if exists artist_backstage_checklists_read on public.artist_backstage_checklists;
create policy artist_backstage_checklists_read
on public.artist_backstage_checklists
for select to authenticated
using(upt_private.artist_backstage_can_view(event_id,(select auth.uid())));

create or replace function public.upt_guestlist_set_backstage_workplace(p_event uuid,p_workplace uuid)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan de backstage werkplek instellen.';
  end if;
  if not exists(select 1 from public.workplaces where id=p_workplace and event_id=p_event and is_active=true) then
    raise exception 'Kies een geldige backstage werkplek van dit evenement.';
  end if;
  insert into public.event_guestlist_settings(event_id,backstage_workplace_id,updated_by,updated_at)
  values(p_event,p_workplace,v_actor,now())
  on conflict(event_id) do update
  set backstage_workplace_id=excluded.backstage_workplace_id,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at;
end
$fn$;

create or replace function public.upt_guestlist_set_artist_hospitality(p_entry uuid,p_drinks text default null,p_notes text default null)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare v_actor uuid:=auth.uid();v_event uuid;v_type text;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan artiestenhospitality beheren.';
  end if;
  select event_id,entry_type into v_event,v_type
  from public.event_guestlist_entries
  where id=p_entry and is_active=true;
  if not found then raise exception 'Guestlist-item niet gevonden.'; end if;
  if v_type<>'artist' then raise exception 'Hospitality kan alleen aan een artiest worden gekoppeld.'; end if;
  if length(coalesce(p_drinks,''))>3000 or length(coalesce(p_notes,''))>3000 then
    raise exception 'Hospitality-informatie is te lang.';
  end if;
  insert into public.artist_backstage_checklists(guestlist_entry_id,event_id,drinks,hospitality_notes,updated_by,updated_at)
  values(p_entry,v_event,nullif(trim(coalesce(p_drinks,'')),''),nullif(trim(coalesce(p_notes,'')),''),v_actor,now())
  on conflict(guestlist_entry_id) do update
  set drinks=excluded.drinks,hospitality_notes=excluded.hospitality_notes,updated_by=v_actor,updated_at=now();
end
$fn$;

create or replace function public.upt_backstage_artist_checklist_update(p_entry uuid,p_drinks_ready boolean,p_artist_received boolean)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_actor uuid:=auth.uid();v_event uuid;v_old_ready boolean;v_old_received boolean;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  select event_id,drinks_ready,artist_received
  into v_event,v_old_ready,v_old_received
  from public.artist_backstage_checklists
  where guestlist_entry_id=p_entry
  for update;
  if not found then raise exception 'Artiestenchecklist niet gevonden.'; end if;
  if not upt_private.artist_backstage_can_view(v_event,v_actor) then
    raise exception 'Geen toegang tot deze backstage checklist.';
  end if;
  update public.artist_backstage_checklists
  set drinks_ready=p_drinks_ready,
      artist_received=p_artist_received,
      drinks_ready_at=case when p_drinks_ready and not v_old_ready then now() when not p_drinks_ready then null else drinks_ready_at end,
      artist_received_at=case when p_artist_received and not v_old_received then now() when not p_artist_received then null else artist_received_at end,
      updated_by=v_actor,updated_at=now()
  where guestlist_entry_id=p_entry;
end
$fn$;

create or replace function upt_private.sync_artist_checklist()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
begin
  if new.entry_type='artist' and new.is_active=true then
    insert into public.artist_backstage_checklists(guestlist_entry_id,event_id)
    values(new.id,new.event_id)
    on conflict(guestlist_entry_id) do update set event_id=excluded.event_id;
  end if;
  return new;
end
$fn$;

drop trigger if exists event_guestlist_artist_checklist_sync on public.event_guestlist_entries;
create trigger event_guestlist_artist_checklist_sync
after insert or update of entry_type,is_active,event_id
on public.event_guestlist_entries
for each row execute function upt_private.sync_artist_checklist();

insert into public.artist_backstage_checklists(guestlist_entry_id,event_id)
select e.id,e.event_id
from public.event_guestlist_entries e
where e.entry_type='artist' and e.is_active=true
on conflict(guestlist_entry_id) do nothing;

create or replace function public.upt_guestlist_checkin(p_entry uuid,p_delta integer)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();v_event uuid;v_total integer;v_checked integer;v_next integer;
  v_type text;v_name text;v_arrival_notified timestamptz;v_backstage uuid;v_channel uuid;
  v_message text;v_notification_count integer:=0;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_delta not in(-1,1) then raise exception 'Ongeldige check-in wijziging.'; end if;

  select event_id,spots_total,spots_checked_in,entry_type,name,arrival_notified_at
  into v_event,v_total,v_checked,v_type,v_name,v_arrival_notified
  from public.event_guestlist_entries
  where id=p_entry and is_active=true
  for update;
  if not found then raise exception 'Guestlist-item niet gevonden.'; end if;
  if not upt_private.guestlist_can_checkin(v_event,v_actor) then raise exception 'Geen toegang om inkom te registreren.'; end if;

  v_next:=v_checked+p_delta;
  if v_next<0 or v_next>v_total then raise exception 'Check-in aantal valt buiten de beschikbare spots.'; end if;

  update public.event_guestlist_entries
  set spots_checked_in=v_next,last_checked_in_by=v_actor,last_checked_in_at=now(),updated_at=now()
  where id=p_entry;

  insert into upt_private.guestlist_checkin_events(guestlist_entry_id,event_id,user_id,delta)
  values(p_entry,v_event,v_actor,p_delta);

  if v_type='artist' and v_checked=0 and v_next>0 and v_arrival_notified is null then
    v_message:='Artiest - '||v_name||', is aangekomen.';
    v_backstage:=upt_private.guestlist_backstage_workplace(v_event);

    update public.event_guestlist_entries set arrival_notified_at=now() where id=p_entry;

    if v_backstage is not null then
      insert into public.crew_notifications(user_id,title,body,link,kind)
      select distinct r.user_id,'Inkom',v_message,
             '/guestlist?event='||v_event::text||'#artist-'||p_entry::text,'artist_arrival'
      from public.responsible_assignments r
      where r.event_id=v_event and r.workplace_id=v_backstage;
      get diagnostics v_notification_count=row_count;

      select c.id into v_channel
      from public.chat_channels c
      where c.kind='workplace' and c.event_id=v_event and c.workplace_id=v_backstage
      order by c.created_at limit 1;

      if v_channel is not null then
        insert into public.messages(user_id,sender_id,channel_id,body,content,event_id,workplace_id)
        values(v_actor,v_actor,v_channel,v_message,v_message,v_event,v_backstage);
      end if;
    end if;

    if v_backstage is null or v_notification_count=0 then
      insert into public.crew_notifications(user_id,title,body,link,kind)
      select p.id,'Backstage opvolging vereist',
             v_message||case when v_backstage is null then ' Stel een backstage werkplek in.' else ' Er is geen backstage manager toegewezen.' end,
             '/guestlist?event='||v_event::text,'artist_arrival_setup'
      from public.profiles p
      where p.role='admin' and p.approved=true and coalesce(p.account_blocked,false)=false;
    end if;
  end if;

  return jsonb_build_object('checkedIn',v_next,'spotsTotal',v_total);
end
$fn$;

create or replace function public.upt_guestlist_import(p_event uuid,p_entries jsonb,p_source_document text default null)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();v_row jsonb;v_name text;v_type text;v_spots integer;v_notes text;
  v_drinks text;v_hospitality text;v_entry uuid;v_inserted integer:=0;v_duplicates integer:=0;v_supplemented integer:=0;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan een guestlist importeren.'; end if;
  if not exists(select 1 from public.events where id=p_event and status<>'archived') then raise exception 'Evenement niet gevonden.'; end if;
  if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)<1 or jsonb_array_length(p_entries)>1000 then raise exception 'Import moet tussen 1 en 1000 regels bevatten.'; end if;
  if length(coalesce(p_source_document,''))>255 then raise exception 'Documentnaam is te lang.'; end if;

  for v_row in select value from jsonb_array_elements(p_entries)
  loop
    v_name:=trim(coalesce(v_row->>'name',v_row->>'naam',''));
    v_type:=lower(trim(coalesce(v_row->>'type','guest')));
    if v_type in('artiest','performer') then v_type:='artist'; end if;
    if v_type not in('artist','guest') then v_type:='guest'; end if;
    begin
      v_spots:=coalesce(nullif(v_row->>'spots','')::integer,nullif(v_row->>'guest_spots','')::integer,nullif(v_row->>'plaatsen','')::integer,1);
    exception when others then v_spots:=1; end;
    v_spots:=greatest(1,least(100,v_spots));
    v_notes:=nullif(left(trim(coalesce(v_row->>'notes',v_row->>'notitie','')),2000),'');
    v_drinks:=nullif(left(trim(coalesce(v_row->>'drinks',v_row->>'drink',v_row->>'drank',v_row->>'beverage',v_row->>'hospitality','')),3000),'');
    v_hospitality:=nullif(left(trim(coalesce(v_row->>'hospitality_notes',v_row->>'backstage_notes',v_row->>'backstage','')),3000),'');

    if length(v_name) not between 1 and 240 then raise exception 'Een geïmporteerde naam is ongeldig.'; end if;

    select e.id into v_entry
    from public.event_guestlist_entries e
    where e.event_id=p_event and e.is_active=true and lower(trim(e.name))=lower(v_name) and e.entry_type=v_type
    order by e.created_at limit 1;

    if v_entry is null then
      insert into public.event_guestlist_entries(event_id,name,entry_type,spots_total,notes,source,source_document_name,created_by)
      values(p_event,v_name,v_type,v_spots,v_notes,'document',nullif(left(trim(coalesce(p_source_document,'')),255),''),v_actor)
      returning id into v_entry;
      v_inserted:=v_inserted+1;
    else
      v_duplicates:=v_duplicates+1;
      update public.event_guestlist_entries e
      set spots_total=greatest(e.spots_checked_in,e.spots_total,v_spots),
          notes=coalesce(e.notes,v_notes),
          source_document_name=coalesce(e.source_document_name,nullif(left(trim(coalesce(p_source_document,'')),255),'')),
          updated_at=now()
      where e.id=v_entry;
      if v_notes is not null or v_drinks is not null or v_hospitality is not null then v_supplemented:=v_supplemented+1; end if;
    end if;

    if v_type='artist' then
      insert into public.artist_backstage_checklists(guestlist_entry_id,event_id,drinks,hospitality_notes,updated_by,updated_at)
      values(v_entry,p_event,v_drinks,v_hospitality,v_actor,now())
      on conflict(guestlist_entry_id) do update
      set drinks=coalesce(nullif(public.artist_backstage_checklists.drinks,''),excluded.drinks),
          hospitality_notes=coalesce(nullif(public.artist_backstage_checklists.hospitality_notes,''),excluded.hospitality_notes),
          updated_by=v_actor,updated_at=now();
    end if;
    v_entry:=null;
  end loop;

  return jsonb_build_object('inserted',v_inserted,'duplicates',v_duplicates,'supplemented',v_supplemented);
end
$fn$;

revoke all on function public.upt_guestlist_set_backstage_workplace(uuid,uuid),
                       public.upt_guestlist_set_artist_hospitality(uuid,text,text),
                       public.upt_backstage_artist_checklist_update(uuid,boolean,boolean)
from public,anon;
grant execute on function public.upt_guestlist_set_backstage_workplace(uuid,uuid),
                          public.upt_guestlist_set_artist_hospitality(uuid,text,text),
                          public.upt_backstage_artist_checklist_update(uuid,boolean,boolean)
to authenticated;

do $do$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='artist_backstage_checklists'
  ) then
    alter publication supabase_realtime add table public.artist_backstage_checklists;
  end if;
end
$do$;

notify pgrst,'reload schema';
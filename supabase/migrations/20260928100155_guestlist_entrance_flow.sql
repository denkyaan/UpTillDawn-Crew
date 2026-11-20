
create table if not exists public.event_guestlist_entries(
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  entry_type text not null default 'guest',
  spots_total integer not null default 1,
  spots_checked_in integer not null default 0,
  notes text,
  source text not null default 'manual',
  source_document_name text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  last_checked_in_by uuid references public.profiles(id) on delete set null,
  last_checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(length(trim(name)) between 1 and 240),
  check(entry_type in('artist','guest')),
  check(spots_total between 1 and 100),
  check(spots_checked_in between 0 and spots_total),
  check(notes is null or length(notes)<=2000),
  check(source in('manual','document','ai')),
  check(source_document_name is null or length(source_document_name)<=255)
);

create index if not exists event_guestlist_entries_event_idx
on public.event_guestlist_entries(event_id,is_active,entry_type,name);

create index if not exists event_guestlist_entries_created_by_idx
on public.event_guestlist_entries(created_by);

create index if not exists event_guestlist_entries_last_checked_in_by_idx
on public.event_guestlist_entries(last_checked_in_by);

create table if not exists upt_private.guestlist_checkin_events(
  id bigint generated always as identity primary key,
  guestlist_entry_id uuid not null references public.event_guestlist_entries(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  delta integer not null check(delta in(-1,1)),
  created_at timestamptz not null default now()
);

create index if not exists guestlist_checkin_events_entry_idx
on upt_private.guestlist_checkin_events(guestlist_entry_id,created_at desc);

create index if not exists guestlist_checkin_events_event_idx
on upt_private.guestlist_checkin_events(event_id,created_at desc);

create index if not exists guestlist_checkin_events_user_idx
on upt_private.guestlist_checkin_events(user_id);

create or replace function upt_private.guestlist_can_view(p_event uuid,p_uid uuid default auth.uid())
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
        select 1 from public.event_members m
        where m.event_id=p_event and m.user_id=p_uid
      )
      or exists(
        select 1 from public.shifts s
        where s.event_id=p_event and s.user_id=p_uid and s.status<>'cancelled'
      )
      or exists(
        select 1 from public.responsible_assignments r
        where r.event_id=p_event and r.user_id=p_uid
      )
    ),
    false
  );
$fn$;

create or replace function upt_private.guestlist_can_checkin(p_event uuid,p_uid uuid default auth.uid())
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
      )
      or exists(
        select 1
        from public.shifts s
        where s.event_id=p_event
          and s.user_id=p_uid
          and s.status<>'cancelled'
          and now() between s.scheduled_start and s.scheduled_end
      )
    ),
    false
  );
$fn$;

revoke all on function upt_private.guestlist_can_view(uuid,uuid),
                       upt_private.guestlist_can_checkin(uuid,uuid)
from public,anon,authenticated;

alter table public.event_guestlist_entries enable row level security;
revoke all on public.event_guestlist_entries from anon;
revoke insert,update,delete on public.event_guestlist_entries from authenticated;
grant select on public.event_guestlist_entries to authenticated;

drop policy if exists event_guestlist_entries_read on public.event_guestlist_entries;
create policy event_guestlist_entries_read
on public.event_guestlist_entries
for select to authenticated
using(
  is_active=true
  and upt_private.guestlist_can_view(event_id,(select auth.uid()))
);

create or replace function public.upt_guestlist_add_entry(
  p_event uuid,
  p_name text,
  p_entry_type text default 'guest',
  p_spots integer default 1,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_actor uuid:=auth.uid();v_id uuid;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan guestlist-items toevoegen.';
  end if;
  if not exists(select 1 from public.events where id=p_event and status<>'archived') then
    raise exception 'Evenement niet gevonden.';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 240 then
    raise exception 'Geef een geldige naam.';
  end if;
  if p_entry_type not in('artist','guest') then raise exception 'Ongeldig guestlist-type.'; end if;
  if p_spots not between 1 and 100 then raise exception 'Aantal spots moet tussen 1 en 100 liggen.'; end if;
  if length(coalesce(p_notes,''))>2000 then raise exception 'Notitie is te lang.'; end if;

  insert into public.event_guestlist_entries(
    event_id,name,entry_type,spots_total,notes,source,created_by
  ) values(
    p_event,trim(p_name),p_entry_type,p_spots,nullif(trim(coalesce(p_notes,'')),''),'manual',v_actor
  )
  returning id into v_id;
  return v_id;
end
$fn$;

create or replace function public.upt_guestlist_update_entry(
  p_entry uuid,
  p_name text,
  p_entry_type text,
  p_spots integer,
  p_notes text default null
) returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_actor uuid:=auth.uid();v_checked integer;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan guestlist-items wijzigen.';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 240 then raise exception 'Geef een geldige naam.'; end if;
  if p_entry_type not in('artist','guest') then raise exception 'Ongeldig guestlist-type.'; end if;
  if p_spots not between 1 and 100 then raise exception 'Aantal spots moet tussen 1 en 100 liggen.'; end if;
  if length(coalesce(p_notes,''))>2000 then raise exception 'Notitie is te lang.'; end if;

  select spots_checked_in into v_checked
  from public.event_guestlist_entries
  where id=p_entry and is_active=true
  for update;
  if not found then raise exception 'Guestlist-item niet gevonden.'; end if;
  if p_spots<v_checked then raise exception 'Aantal spots kan niet lager zijn dan reeds ingecheckte spots.'; end if;

  update public.event_guestlist_entries
  set name=trim(p_name),
      entry_type=p_entry_type,
      spots_total=p_spots,
      notes=nullif(trim(coalesce(p_notes,'')),''),
      updated_at=now()
  where id=p_entry;
end
$fn$;

create or replace function public.upt_guestlist_remove_entry(p_entry uuid)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan guestlist-items verwijderen.';
  end if;
  update public.event_guestlist_entries
  set is_active=false,updated_at=now()
  where id=p_entry and is_active=true;
  if not found then raise exception 'Guestlist-item niet gevonden.'; end if;
end
$fn$;

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
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_delta not in(-1,1) then raise exception 'Ongeldige check-in wijziging.'; end if;

  select event_id,spots_total,spots_checked_in
  into v_event,v_total,v_checked
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
  v_name text;
  v_type text;
  v_spots integer;
  v_notes text;
  v_inserted integer:=0;
  v_duplicates integer:=0;
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

    if exists(
      select 1
      from public.event_guestlist_entries e
      where e.event_id=p_event
        and e.is_active=true
        and lower(trim(e.name))=lower(v_name)
        and e.entry_type=v_type
    ) then
      v_duplicates:=v_duplicates+1;
      continue;
    end if;

    insert into public.event_guestlist_entries(
      event_id,name,entry_type,spots_total,notes,source,source_document_name,created_by
    ) values(
      p_event,v_name,v_type,v_spots,v_notes,'document',
      nullif(left(trim(coalesce(p_source_document,'')),255),''),
      v_actor
    );
    v_inserted:=v_inserted+1;
  end loop;

  return jsonb_build_object('inserted',v_inserted,'duplicates',v_duplicates);
end
$fn$;

revoke all on function public.upt_guestlist_add_entry(uuid,text,text,integer,text),
                       public.upt_guestlist_update_entry(uuid,text,text,integer,text),
                       public.upt_guestlist_remove_entry(uuid),
                       public.upt_guestlist_checkin(uuid,integer),
                       public.upt_guestlist_import(uuid,jsonb,text)
from public,anon;

grant execute on function public.upt_guestlist_add_entry(uuid,text,text,integer,text),
                          public.upt_guestlist_update_entry(uuid,text,text,integer,text),
                          public.upt_guestlist_remove_entry(uuid),
                          public.upt_guestlist_checkin(uuid,integer),
                          public.upt_guestlist_import(uuid,jsonb,text)
to authenticated;

do $do$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='event_guestlist_entries'
  ) then
    alter publication supabase_realtime add table public.event_guestlist_entries;
  end if;
end
$do$;

insert into public.role_ui_rules(role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings)
values
  ('admin','guestlist','Guestlist & Inkom','navigation',true,true,'always',68,'{}'::jsonb),
  ('responsible_lead','guestlist','Guestlist & Inkom','navigation',true,true,'assigned_event',78,'{}'::jsonb),
  ('staff','guestlist','Guestlist & Inkom','navigation',true,true,'assigned_event',78,'{}'::jsonb)
on conflict(role,feature_key) do update
set label=excluded.label,
    group_key=excluded.group_key,
    visible=true,
    enabled=true,
    condition_key=excluded.condition_key,
    sort_order=excluded.sort_order,
    settings=excluded.settings;

notify pgrst,'reload schema';

create table if not exists public.operational_checklists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  kind text not null check (kind in ('opening','closing','safety','custom')),
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  status text not null default 'open' check (status in ('open','completed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status='completed')=(completed_at is not null))
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.operational_checklists(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 300),
  required boolean not null default true,
  requires_photo boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((completed_at is null and completed_by is null and photo_path is null) or (completed_at is not null and completed_by is not null)),
  check (not requires_photo or completed_at is null or photo_path is not null)
);

alter table public.operational_checklists enable row level security;
alter table public.checklist_items enable row level security;

revoke all on table public.operational_checklists from anon;
revoke all on table public.checklist_items from anon;
revoke insert,update,delete on table public.operational_checklists from authenticated;
revoke insert,update,delete on table public.checklist_items from authenticated;
grant select on table public.operational_checklists to authenticated;
grant select on table public.checklist_items to authenticated;

drop policy if exists operational_checklists_read on public.operational_checklists;
create policy operational_checklists_read
on public.operational_checklists
for select
to authenticated
using (
  public.upt_is_approved()
  and (
    public.upt_is_admin(auth.uid())
    or public.upt_is_responsible(event_id,workplace_id,auth.uid())
    or exists(
      select 1
      from public.upt_current_work_context() ctx
      where ctx.event_id=operational_checklists.event_id
        and ctx.workplace_id=operational_checklists.workplace_id
    )
  )
);

drop policy if exists checklist_items_read on public.checklist_items;
create policy checklist_items_read
on public.checklist_items
for select
to authenticated
using (
  exists(
    select 1
    from public.operational_checklists checklist
    where checklist.id=checklist_items.checklist_id
  )
);

create index if not exists operational_checklists_event_workplace_idx
on public.operational_checklists(event_id,workplace_id,status,created_at desc);

create index if not exists operational_checklists_created_by_idx
on public.operational_checklists(created_by);

create index if not exists operational_checklists_completed_by_idx
on public.operational_checklists(completed_by)
where completed_by is not null;

create index if not exists checklist_items_checklist_sort_idx
on public.checklist_items(checklist_id,sort_order,created_at);

create index if not exists checklist_items_completed_by_idx
on public.checklist_items(completed_by)
where completed_by is not null;

create or replace function public.upt_create_operational_checklist(
  p_event uuid,
  p_workplace uuid,
  p_kind text,
  p_title text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_id uuid;
  v_description text:=nullif(trim(coalesce(p_description,'')),'');
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_kind not in ('opening','closing','safety','custom') then raise exception 'Ongeldig checklisttype.'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 200 then raise exception 'Geef een geldige checklistnaam.'; end if;

  perform 1
  from public.workplaces w
  join public.events e on e.id=w.event_id
  where w.id=p_workplace
    and w.event_id=p_event
    and w.is_active=true
    and coalesce(e.status,'')<>'archived'
    and now()<=e.end_at
  for update of w;
  if not found then raise exception 'Werkplek of evenement is niet beschikbaar.'; end if;

  if not public.upt_is_admin(v_actor) then
    if not public.upt_is_responsible(p_event,p_workplace,v_actor) then
      raise exception 'Alleen admin of de verantwoordelijke van deze werkplek kan checklists beheren.';
    end if;
    if not public.upt_feature_allowed('tasks',p_event,p_workplace) then
      raise exception 'Checklists zijn voor jouw rol op dit moment niet beschikbaar.';
    end if;
  end if;

  insert into public.operational_checklists(
    event_id,workplace_id,kind,title,description,created_by
  )
  values(
    p_event,p_workplace,p_kind,trim(p_title),v_description,v_actor
  )
  returning id into v_id;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'checklist.created','operational_checklist',v_id,jsonb_build_object(
    'event_id',p_event,
    'workplace_id',p_workplace,
    'kind',p_kind
  ));

  return v_id;
end;
$function$;

revoke all on function public.upt_create_operational_checklist(uuid,uuid,text,text,text)
from public,anon;
grant execute on function public.upt_create_operational_checklist(uuid,uuid,text,text,text)
to authenticated;

create or replace function public.upt_add_operational_checklist_item(
  p_checklist uuid,
  p_label text,
  p_required boolean default true,
  p_requires_photo boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_checklist public.operational_checklists%rowtype;
  v_id uuid;
  v_sort integer;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_label is null or length(trim(p_label)) not between 1 and 300 then raise exception 'Geef een geldig checklistpunt.'; end if;

  select * into v_checklist
  from public.operational_checklists
  where id=p_checklist
  for update;

  if not found then raise exception 'Checklist niet gevonden.'; end if;
  if v_checklist.status<>'open' then raise exception 'Afgeronde checklist kan niet worden gewijzigd.'; end if;
  if not public.upt_is_admin(v_actor) then
    if not public.upt_is_responsible(v_checklist.event_id,v_checklist.workplace_id,v_actor) then
      raise exception 'Geen toegang.';
    end if;
    if not public.upt_feature_allowed('tasks',v_checklist.event_id,v_checklist.workplace_id) then
      raise exception 'Checklists zijn voor jouw rol op dit moment niet beschikbaar.';
    end if;
  end if;

  select coalesce(max(sort_order),-1)+1
  into v_sort
  from public.checklist_items
  where checklist_id=p_checklist;

  insert into public.checklist_items(
    checklist_id,label,required,requires_photo,sort_order
  )
  values(
    p_checklist,trim(p_label),coalesce(p_required,true),coalesce(p_requires_photo,false),v_sort
  )
  returning id into v_id;

  update public.operational_checklists
  set updated_at=now()
  where id=p_checklist;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'checklist.item.created','checklist_item',v_id,jsonb_build_object(
    'checklist_id',p_checklist,
    'required',coalesce(p_required,true),
    'requires_photo',coalesce(p_requires_photo,false)
  ));

  return v_id;
end;
$function$;

revoke all on function public.upt_add_operational_checklist_item(uuid,text,boolean,boolean)
from public,anon;
grant execute on function public.upt_add_operational_checklist_item(uuid,text,boolean,boolean)
to authenticated;

create or replace function public.upt_remove_operational_checklist_item(p_item uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_item public.checklist_items%rowtype;
  v_checklist public.operational_checklists%rowtype;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;

  select * into v_item
  from public.checklist_items
  where id=p_item
  for update;
  if not found then raise exception 'Checklistpunt niet gevonden.'; end if;

  select * into v_checklist
  from public.operational_checklists
  where id=v_item.checklist_id
  for update;
  if not found then raise exception 'Checklist niet gevonden.'; end if;
  if v_checklist.status<>'open' then raise exception 'Afgeronde checklist kan niet worden gewijzigd.'; end if;

  if not public.upt_is_admin(v_actor)
    and not public.upt_is_responsible(v_checklist.event_id,v_checklist.workplace_id,v_actor)
  then raise exception 'Geen toegang.'; end if;

  delete from public.checklist_items where id=p_item;
  update public.operational_checklists set updated_at=now() where id=v_checklist.id;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'checklist.item.removed','operational_checklist',v_checklist.id,jsonb_build_object(
    'item_id',p_item,
    'label',v_item.label
  ));
end;
$function$;

revoke all on function public.upt_remove_operational_checklist_item(uuid)
from public,anon;
grant execute on function public.upt_remove_operational_checklist_item(uuid)
to authenticated;

create or replace function public.upt_set_operational_checklist_item(
  p_item uuid,
  p_complete boolean,
  p_photo_path text default null
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private','storage'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_item public.checklist_items%rowtype;
  v_checklist public.operational_checklists%rowtype;
  v_manager boolean;
  v_current boolean;
  v_photo text:=nullif(trim(coalesce(p_photo_path,'')),'');
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;

  select * into v_item
  from public.checklist_items
  where id=p_item
  for update;
  if not found then raise exception 'Checklistpunt niet gevonden.'; end if;

  select * into v_checklist
  from public.operational_checklists
  where id=v_item.checklist_id
  for update;
  if not found then raise exception 'Checklist niet gevonden.'; end if;
  if v_checklist.status<>'open' then raise exception 'Deze checklist is al afgerond.'; end if;

  v_manager:=public.upt_is_admin(v_actor)
    or public.upt_is_responsible(v_checklist.event_id,v_checklist.workplace_id,v_actor);

  select exists(
    select 1
    from public.upt_current_work_context() ctx
    where ctx.event_id=v_checklist.event_id
      and ctx.workplace_id=v_checklist.workplace_id
  ) into v_current;

  if not v_manager and not v_current then
    raise exception 'Checklistpunt kan alleen tijdens je actieve shift op deze werkplek worden bijgewerkt.';
  end if;
  if not public.upt_is_admin(v_actor)
    and not public.upt_feature_allowed('tasks',v_checklist.event_id,v_checklist.workplace_id)
  then raise exception 'Checklists zijn voor jouw rol op dit moment niet beschikbaar.'; end if;

  if coalesce(p_complete,false) then
    if v_item.requires_photo and v_photo is null then
      raise exception 'Voor dit checklistpunt is een foto verplicht.';
    end if;

    if v_photo is not null then
      if split_part(v_photo,'/',1)<>v_actor::text
        or split_part(v_photo,'/',2)<>'checklist'
        or split_part(v_photo,'/',3)<>p_item::text
      then raise exception 'Ongeldig fotopad.'; end if;

      if not exists(
        select 1
        from storage.objects o
        where o.bucket_id='work-media'
          and o.name=v_photo
      ) then raise exception 'Checklistfoto niet gevonden.'; end if;
    end if;

    update public.checklist_items
    set completed_by=v_actor,
        completed_at=now(),
        photo_path=coalesce(v_photo,case when requires_photo then null else photo_path end),
        updated_at=now()
    where id=p_item;
  else
    if not v_manager and v_item.completed_by is distinct from v_actor then
      raise exception 'Alleen de uitvoerder of manager kan dit punt opnieuw openen.';
    end if;

    update public.checklist_items
    set completed_by=null,
        completed_at=null,
        photo_path=null,
        updated_at=now()
    where id=p_item;
  end if;

  update public.operational_checklists
  set updated_at=now()
  where id=v_checklist.id;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_actor,
    case when coalesce(p_complete,false) then 'checklist.item.completed' else 'checklist.item.reopened' end,
    'checklist_item',
    p_item,
    jsonb_build_object(
      'checklist_id',v_checklist.id,
      'photo_attached',v_photo is not null
    )
  );
end;
$function$;

revoke all on function public.upt_set_operational_checklist_item(uuid,boolean,text)
from public,anon;
grant execute on function public.upt_set_operational_checklist_item(uuid,boolean,text)
to authenticated;

create or replace function public.upt_close_operational_checklist(p_checklist uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_checklist public.operational_checklists%rowtype;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;

  select * into v_checklist
  from public.operational_checklists
  where id=p_checklist
  for update;
  if not found then raise exception 'Checklist niet gevonden.'; end if;

  if not public.upt_is_admin(v_actor)
    and not public.upt_is_responsible(v_checklist.event_id,v_checklist.workplace_id,v_actor)
  then raise exception 'Alleen admin of de verantwoordelijke kan een checklist afsluiten.'; end if;

  if not exists(select 1 from public.checklist_items where checklist_id=p_checklist) then
    raise exception 'Voeg minstens één checklistpunt toe.';
  end if;

  if exists(
    select 1
    from public.checklist_items item
    where item.checklist_id=p_checklist
      and item.required=true
      and (
        item.completed_at is null
        or (item.requires_photo and item.photo_path is null)
      )
  ) then raise exception 'Voltooi eerst alle verplichte checklistpunten.'; end if;

  update public.operational_checklists
  set status='completed',
      completed_by=v_actor,
      completed_at=now(),
      updated_at=now()
  where id=p_checklist;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'checklist.completed','operational_checklist',p_checklist,jsonb_build_object(
    'event_id',v_checklist.event_id,
    'workplace_id',v_checklist.workplace_id
  ));
end;
$function$;

revoke all on function public.upt_close_operational_checklist(uuid)
from public,anon;
grant execute on function public.upt_close_operational_checklist(uuid)
to authenticated;

create or replace function public.upt_reopen_operational_checklist(p_checklist uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_checklist public.operational_checklists%rowtype;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;

  select * into v_checklist
  from public.operational_checklists
  where id=p_checklist
  for update;
  if not found then raise exception 'Checklist niet gevonden.'; end if;

  if not public.upt_is_admin(v_actor)
    and not public.upt_is_responsible(v_checklist.event_id,v_checklist.workplace_id,v_actor)
  then raise exception 'Alleen admin of de verantwoordelijke kan een checklist heropenen.'; end if;

  update public.operational_checklists
  set status='open',
      completed_by=null,
      completed_at=null,
      updated_at=now()
  where id=p_checklist;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'checklist.reopened','operational_checklist',p_checklist,'{}'::jsonb);
end;
$function$;

revoke all on function public.upt_reopen_operational_checklist(uuid)
from public,anon;
grant execute on function public.upt_reopen_operational_checklist(uuid)
to authenticated;

drop policy if exists upt_work_media_checklist_read on storage.objects;
create policy upt_work_media_checklist_read
on storage.objects
for select
to authenticated
using (
  bucket_id='work-media'
  and public.upt_is_approved()
  and exists(
    select 1
    from public.checklist_items item
    join public.operational_checklists checklist on checklist.id=item.checklist_id
    where item.photo_path=objects.name
      and (
        public.upt_is_admin(auth.uid())
        or public.upt_is_responsible(checklist.event_id,checklist.workplace_id,auth.uid())
        or exists(
          select 1
          from public.upt_current_work_context() ctx
          where ctx.event_id=checklist.event_id
            and ctx.workplace_id=checklist.workplace_id
        )
      )
  )
);

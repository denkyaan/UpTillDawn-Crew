-- Central workplace inventory hub: assigned-role visibility, free-text notes and opening/closing condition reports.

insert into public.role_ui_rules(role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings)
values
  ('admin','inventory','Inventaris','operations',true,true,'always',65,'{}'::jsonb),
  ('responsible_lead','inventory','Inventaris','operations',true,true,'assigned_workplace_role',65,'{}'::jsonb),
  ('staff','inventory','Inventaris','operations',true,true,'assigned_workplace_role',65,'{}'::jsonb)
on conflict (role,feature_key) do update
set label=excluded.label,
    group_key=excluded.group_key,
    visible=excluded.visible,
    enabled=excluded.enabled,
    condition_key=excluded.condition_key,
    sort_order=excluded.sort_order,
    settings=excluded.settings;

create or replace function upt_private.inventory_can_view(p_event uuid,p_workplace uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $fn$
  select coalesce(
    public.upt_is_approved()
    and (
      public.upt_is_admin((select auth.uid()))
      or public.upt_is_responsible(p_event,p_workplace,(select auth.uid()))
      or (
        public.upt_feature_allowed('inventory',p_event,p_workplace)
        and exists(
          select 1
          from public.shifts s
          where s.event_id=p_event
            and s.workplace_id=p_workplace
            and s.user_id=(select auth.uid())
            and s.status<>'cancelled'
            and s.response_status<>'declined'
        )
      )
    ),
    false
  );
$fn$;

revoke all on function upt_private.inventory_can_view(uuid,uuid)
from public,anon,authenticated;

create or replace function upt_private.document_can_view(
  p_event uuid,
  p_workplace uuid,
  p_audience text
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $fn$
  select coalesce(
    public.upt_is_admin((select auth.uid()))
    or (
      public.upt_feature_allowed('documents',p_event,p_workplace)
      and upt_private.document_role_rank(
        upt_private.document_view_role(p_event,p_workplace)
      ) >= upt_private.document_role_rank(p_audience)
    ),
    false
  );
$fn$;

revoke all on function upt_private.document_can_view(uuid,uuid,text)
from public,anon,authenticated;

create or replace function upt_private.document_can_manage(
  p_event uuid,
  p_workplace uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $fn$
  select coalesce(
    public.upt_is_admin((select auth.uid()))
    or (
      public.upt_feature_allowed('documents',p_event,p_workplace)
      and p_workplace is not null
      and public.upt_is_responsible(p_event,p_workplace,(select auth.uid()))
    ),
    false
  );
$fn$;

revoke all on function upt_private.document_can_manage(uuid,uuid)
from public,anon,authenticated;

create table if not exists public.workplace_inventory_notes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  category text,
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null check (length(trim(body)) between 1 and 10000),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (category is null or length(category) <= 120)
);

create index if not exists workplace_inventory_notes_workplace_idx
on public.workplace_inventory_notes(workplace_id,created_at desc)
where is_active=true;

create index if not exists workplace_inventory_notes_event_idx
on public.workplace_inventory_notes(event_id,created_at desc)
where is_active=true;

create index if not exists workplace_inventory_notes_created_by_idx
on public.workplace_inventory_notes(created_by);

alter table public.workplace_inventory_notes enable row level security;
revoke all on table public.workplace_inventory_notes from anon;
revoke insert,update,delete on table public.workplace_inventory_notes from authenticated;
grant select on table public.workplace_inventory_notes to authenticated;

drop policy if exists workplace_inventory_notes_read on public.workplace_inventory_notes;
create policy workplace_inventory_notes_read
on public.workplace_inventory_notes
for select
to authenticated
using (
  is_active=true
  and upt_private.inventory_can_view(event_id,workplace_id)
);

create or replace function public.upt_create_workplace_inventory_note(
  p_workplace uuid,
  p_title text,
  p_body text,
  p_category text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_event uuid;
  v_id uuid;
  v_category text:=nullif(trim(coalesce(p_category,'')),'');
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan inventaristekst beheren.'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 200 then raise exception 'Geef een geldige titel.'; end if;
  if p_body is null or length(trim(p_body)) not between 1 and 10000 then raise exception 'Geef geldige inventaristekst.'; end if;
  if v_category is not null and length(v_category)>120 then raise exception 'Categorie is te lang.'; end if;

  select w.event_id into v_event
  from public.workplaces w
  join public.events e on e.id=w.event_id
  where w.id=p_workplace
    and w.is_active=true
    and coalesce(e.status,'')<>'archived'
  for update of w;
  if not found then raise exception 'Werkplek niet gevonden.'; end if;

  insert into public.workplace_inventory_notes(
    event_id,workplace_id,category,title,body,created_by
  )
  values(
    v_event,p_workplace,v_category,trim(p_title),trim(p_body),v_actor
  )
  returning id into v_id;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.note.created','workplace_inventory_note',v_id,jsonb_build_object(
    'event_id',v_event,'workplace_id',p_workplace,'category',v_category
  ));

  return v_id;
end;
$function$;

revoke all on function public.upt_create_workplace_inventory_note(uuid,text,text,text)
from public,anon;
grant execute on function public.upt_create_workplace_inventory_note(uuid,text,text,text)
to authenticated;

create or replace function public.upt_archive_workplace_inventory_note(p_note uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_note public.workplace_inventory_notes%rowtype;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan inventaristekst beheren.'; end if;

  select * into v_note
  from public.workplace_inventory_notes
  where id=p_note
  for update;
  if not found then raise exception 'Inventaristekst niet gevonden.'; end if;

  update public.workplace_inventory_notes
  set is_active=false,updated_at=now()
  where id=p_note;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.note.archived','workplace_inventory_note',p_note,jsonb_build_object(
    'event_id',v_note.event_id,'workplace_id',v_note.workplace_id
  ));
end;
$function$;

revoke all on function public.upt_archive_workplace_inventory_note(uuid)
from public,anon;
grant execute on function public.upt_archive_workplace_inventory_note(uuid)
to authenticated;

create or replace function public.upt_report_workplace_inventory_condition(
  p_item uuid,
  p_phase text,
  p_condition text,
  p_quantity integer,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_item public.inventory_items%rowtype;
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
  v_phase_label text;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_phase not in ('opening','closing') then raise exception 'Kies opstart of sluiting.'; end if;
  if p_condition not in ('damaged','missing') then raise exception 'Kies kapot of ontbrekend.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100000 then raise exception 'Ongeldige hoeveelheid.'; end if;
  if length(coalesce(v_notes,''))>1000 then raise exception 'Notitie is te lang.'; end if;

  select * into v_item
  from public.inventory_items
  where id=p_item
    and is_active=true
  for update;
  if not found then raise exception 'Materiaal niet gevonden.'; end if;

  if not (
    public.upt_is_admin(v_actor)
    or public.upt_is_responsible(v_item.event_id,v_item.workplace_id,v_actor)
  ) then
    raise exception 'Alleen admin of de verantwoordelijke van deze werkplek kan materiaal controleren.';
  end if;

  if p_quantity>v_item.available_quantity then
    raise exception 'Je kunt niet meer melden dan de beschikbare werkplekvoorraad.';
  end if;

  update public.inventory_items
  set available_quantity=available_quantity-p_quantity,
      damaged_quantity=damaged_quantity+case when p_condition='damaged' then p_quantity else 0 end,
      missing_quantity=missing_quantity+case when p_condition='missing' then p_quantity else 0 end,
      updated_at=now()
  where id=v_item.id;

  v_phase_label:=case when p_phase='opening' then 'OPSTART' else 'SLUITING' end;

  insert into public.inventory_movements(
    item_id,event_id,workplace_id,actor_id,movement_type,quantity,notes
  )
  values(
    v_item.id,v_item.event_id,v_item.workplace_id,v_actor,p_condition,p_quantity,
    v_phase_label||case when v_notes is null then '' else ' · '||v_notes end
  );

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_actor,
    'inventory.workplace.'||p_phase||'.'||p_condition,
    'inventory_item',
    v_item.id,
    jsonb_build_object(
      'event_id',v_item.event_id,
      'workplace_id',v_item.workplace_id,
      'phase',p_phase,
      'condition',p_condition,
      'quantity',p_quantity,
      'notes',v_notes
    )
  );

  insert into public.crew_notifications(user_id,title,body,link,kind)
  select p.id,
    case when p_condition='damaged' then 'Kapot materiaal gemeld' else 'Ontbrekend materiaal gemeld' end,
    trim(v_item.name)||' · '||p_quantity::text||' stuk(s) · '||lower(v_phase_label),
    '/inventory',
    'inventory'
  from public.profiles p
  where p.approved=true
    and p.role='admin'
    and p.id<>v_actor;
end;
$function$;

revoke all on function public.upt_report_workplace_inventory_condition(uuid,text,text,integer,text)
from public,anon;
grant execute on function public.upt_report_workplace_inventory_condition(uuid,text,text,integer,text)
to authenticated;

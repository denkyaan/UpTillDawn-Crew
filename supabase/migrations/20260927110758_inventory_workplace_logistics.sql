insert into public.role_ui_rules(role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings)
values
  ('admin','inventory','Materiaal','operations',true,true,'always',65,'{}'::jsonb),
  ('responsible_lead','inventory','Materiaal','operations',true,true,'assigned_workplace_role',65,'{}'::jsonb),
  ('staff','inventory','Materiaal','operations',true,true,'shift_active',65,'{}'::jsonb)
on conflict (role,feature_key) do nothing;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  category text,
  total_quantity integer not null check (total_quantity >= 0),
  available_quantity integer not null check (available_quantity >= 0),
  issued_quantity integer not null default 0 check (issued_quantity >= 0),
  damaged_quantity integer not null default 0 check (damaged_quantity >= 0),
  missing_quantity integer not null default 0 check (missing_quantity >= 0),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_quantity = available_quantity + issued_quantity + damaged_quantity + missing_quantity)
);

create unique index if not exists inventory_items_workplace_name_unique
on public.inventory_items(workplace_id,lower(name))
where is_active=true;

create index if not exists inventory_items_event_idx
on public.inventory_items(event_id);

create index if not exists inventory_items_created_by_idx
on public.inventory_items(created_by);

create table if not exists public.inventory_issues (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  outstanding_quantity integer not null check (outstanding_quantity >= 0 and outstanding_quantity <= quantity),
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  check ((outstanding_quantity=0) = (closed_at is not null))
);

create index if not exists inventory_issues_item_open_idx
on public.inventory_issues(item_id,issued_at desc)
where outstanding_quantity>0;

create index if not exists inventory_issues_user_open_idx
on public.inventory_issues(user_id,issued_at desc)
where outstanding_quantity>0;

create index if not exists inventory_issues_event_workplace_idx
on public.inventory_issues(event_id,workplace_id,issued_at desc);

create index if not exists inventory_issues_issued_by_idx
on public.inventory_issues(issued_by);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  issue_id uuid references public.inventory_issues(id) on delete set null,
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid references public.profiles(id) on delete set null,
  movement_type text not null check (movement_type in (
    'created','restocked','issued','returned','damaged','missing','restored-damaged','restored-missing'
  )),
  quantity integer not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_item_created_idx
on public.inventory_movements(item_id,created_at desc);

create index if not exists inventory_movements_issue_idx
on public.inventory_movements(issue_id)
where issue_id is not null;

create index if not exists inventory_movements_event_workplace_idx
on public.inventory_movements(event_id,workplace_id,created_at desc);

create index if not exists inventory_movements_actor_idx
on public.inventory_movements(actor_id);

create index if not exists inventory_movements_target_user_idx
on public.inventory_movements(target_user_id)
where target_user_id is not null;

alter table public.inventory_items enable row level security;
alter table public.inventory_issues enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on table public.inventory_items from anon;
revoke all on table public.inventory_issues from anon;
revoke all on table public.inventory_movements from anon;

revoke insert,update,delete on table public.inventory_items from authenticated;
revoke insert,update,delete on table public.inventory_issues from authenticated;
revoke insert,update,delete on table public.inventory_movements from authenticated;

grant select on table public.inventory_items to authenticated;
grant select on table public.inventory_issues to authenticated;
grant select on table public.inventory_movements to authenticated;

create or replace function upt_private.inventory_can_manage(p_event uuid,p_workplace uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select coalesce(
    public.upt_feature_allowed('inventory',p_event,p_workplace)
    and (
      public.upt_is_admin((select auth.uid()))
      or public.upt_is_responsible(p_event,p_workplace,(select auth.uid()))
    ),
    false
  );
$$;

revoke all on function upt_private.inventory_can_manage(uuid,uuid)
from public,anon,authenticated;

create or replace function upt_private.inventory_can_view(p_event uuid,p_workplace uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select coalesce(
    public.upt_feature_allowed('inventory',p_event,p_workplace)
    and (
      public.upt_is_admin((select auth.uid()))
      or public.upt_is_responsible(p_event,p_workplace,(select auth.uid()))
      or exists(
        select 1
        from public.upt_current_work_context() ctx
        where ctx.event_id=p_event
          and ctx.workplace_id=p_workplace
      )
    ),
    false
  );
$$;

revoke all on function upt_private.inventory_can_view(uuid,uuid)
from public,anon,authenticated;

drop policy if exists inventory_items_read on public.inventory_items;
create policy inventory_items_read
on public.inventory_items
for select
to authenticated
using (upt_private.inventory_can_view(event_id,workplace_id));

drop policy if exists inventory_issues_read on public.inventory_issues;
create policy inventory_issues_read
on public.inventory_issues
for select
to authenticated
using (
  public.upt_is_approved()
  and (
    user_id=(select auth.uid())
    or upt_private.inventory_can_manage(event_id,workplace_id)
  )
);

drop policy if exists inventory_movements_read on public.inventory_movements;
create policy inventory_movements_read
on public.inventory_movements
for select
to authenticated
using (
  public.upt_is_approved()
  and (
    target_user_id=(select auth.uid())
    or upt_private.inventory_can_manage(event_id,workplace_id)
  )
);

create or replace function public.upt_create_inventory_item(
  p_workplace uuid,
  p_name text,
  p_category text default null,
  p_quantity integer default 1
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_event uuid;
  v_item uuid;
  v_category text:=nullif(trim(coalesce(p_category,'')),'');
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 200 then raise exception 'Geef een geldige materiaalnaam.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100000 then raise exception 'Ongeldige hoeveelheid.'; end if;

  select w.event_id into v_event
  from public.workplaces w
  join public.events e on e.id=w.event_id
  where w.id=p_workplace
    and w.is_active=true
    and coalesce(e.status,'')<>'archived'
    and now()<=e.end_at
  for update of w;
  if not found then raise exception 'Werkplek niet beschikbaar.'; end if;

  if not upt_private.inventory_can_manage(v_event,p_workplace) then
    raise exception 'Geen toegang tot materiaalbeheer op deze werkplek.';
  end if;

  begin
    insert into public.inventory_items(
      event_id,workplace_id,name,category,total_quantity,available_quantity,created_by
    )
    values(v_event,p_workplace,trim(p_name),v_category,p_quantity,p_quantity,v_actor)
    returning id into v_item;
  exception when unique_violation then
    raise exception 'Er bestaat al actief materiaal met deze naam op de werkplek.';
  end;

  insert into public.inventory_movements(
    item_id,event_id,workplace_id,actor_id,movement_type,quantity,notes
  )
  values(v_item,v_event,p_workplace,v_actor,'created',p_quantity,'Initiële voorraad');

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.item.created','inventory_item',v_item,jsonb_build_object(
    'event_id',v_event,'workplace_id',p_workplace,'quantity',p_quantity
  ));

  return v_item;
end;
$function$;

revoke all on function public.upt_create_inventory_item(uuid,text,text,integer)
from public,anon;
grant execute on function public.upt_create_inventory_item(uuid,text,text,integer)
to authenticated;

create or replace function public.upt_restock_inventory_item(
  p_item uuid,
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
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100000 then raise exception 'Ongeldige hoeveelheid.'; end if;

  select * into v_item
  from public.inventory_items
  where id=p_item
  for update;
  if not found or not v_item.is_active then raise exception 'Materiaal niet gevonden.'; end if;
  if not upt_private.inventory_can_manage(v_item.event_id,v_item.workplace_id) then raise exception 'Geen toegang.'; end if;

  update public.inventory_items
  set total_quantity=total_quantity+p_quantity,
      available_quantity=available_quantity+p_quantity,
      updated_at=now()
  where id=p_item;

  insert into public.inventory_movements(
    item_id,event_id,workplace_id,actor_id,movement_type,quantity,notes
  )
  values(p_item,v_item.event_id,v_item.workplace_id,v_actor,'restocked',p_quantity,v_notes);

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.restocked','inventory_item',p_item,jsonb_build_object('quantity',p_quantity));
end;
$function$;

revoke all on function public.upt_restock_inventory_item(uuid,integer,text)
from public,anon;
grant execute on function public.upt_restock_inventory_item(uuid,integer,text)
to authenticated;

create or replace function public.upt_issue_inventory(
  p_item uuid,
  p_user uuid,
  p_quantity integer,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_item public.inventory_items%rowtype;
  v_issue uuid;
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100000 then raise exception 'Ongeldige hoeveelheid.'; end if;

  select * into v_item
  from public.inventory_items
  where id=p_item
  for update;
  if not found or not v_item.is_active then raise exception 'Materiaal niet gevonden.'; end if;
  if not upt_private.inventory_can_manage(v_item.event_id,v_item.workplace_id) then raise exception 'Geen toegang.'; end if;
  if v_item.available_quantity<p_quantity then raise exception 'Onvoldoende materiaal beschikbaar.'; end if;

  if not exists(
    select 1
    from public.profiles p
    join public.shifts s on s.user_id=p.id
    where p.id=p_user
      and p.approved=true
      and s.event_id=v_item.event_id
      and s.workplace_id=v_item.workplace_id
      and s.status<>'cancelled'
      and s.response_status<>'declined'
      and s.scheduled_end>now()
  ) then raise exception 'Kies ingepland personeel van deze werkplek.'; end if;

  update public.inventory_items
  set available_quantity=available_quantity-p_quantity,
      issued_quantity=issued_quantity+p_quantity,
      updated_at=now()
  where id=p_item;

  insert into public.inventory_issues(
    item_id,event_id,workplace_id,user_id,quantity,outstanding_quantity,issued_by,notes
  )
  values(
    p_item,v_item.event_id,v_item.workplace_id,p_user,p_quantity,p_quantity,v_actor,v_notes
  )
  returning id into v_issue;

  insert into public.inventory_movements(
    item_id,issue_id,event_id,workplace_id,actor_id,target_user_id,movement_type,quantity,notes
  )
  values(
    p_item,v_issue,v_item.event_id,v_item.workplace_id,v_actor,p_user,'issued',p_quantity,v_notes
  );

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.issued','inventory_issue',v_issue,jsonb_build_object(
    'item_id',p_item,'user_id',p_user,'quantity',p_quantity
  ));

  insert into public.crew_notifications(user_id,title,body,link,kind)
  values(
    p_user,
    'Materiaal toegewezen',
    trim(v_item.name)||' · '||p_quantity::text||' stuk(s)',
    '/tasks',
    'inventory'
  );

  return v_issue;
end;
$function$;

revoke all on function public.upt_issue_inventory(uuid,uuid,integer,text)
from public,anon;
grant execute on function public.upt_issue_inventory(uuid,uuid,integer,text)
to authenticated;

create or replace function public.upt_settle_inventory_issue(
  p_issue uuid,
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
  v_issue public.inventory_issues%rowtype;
  v_item public.inventory_items%rowtype;
  v_manage boolean;
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
  v_remaining integer;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_condition not in ('returned','damaged','missing') then raise exception 'Ongeldige materiaalstatus.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100000 then raise exception 'Ongeldige hoeveelheid.'; end if;

  select * into v_issue
  from public.inventory_issues
  where id=p_issue
  for update;
  if not found or v_issue.outstanding_quantity<=0 then raise exception 'Uitgifte is al volledig verwerkt.'; end if;

  select * into v_item
  from public.inventory_items
  where id=v_issue.item_id
  for update;
  if not found then raise exception 'Materiaal niet gevonden.'; end if;

  v_manage:=upt_private.inventory_can_manage(v_issue.event_id,v_issue.workplace_id);

  if not v_manage then
    if v_issue.user_id<>v_actor then raise exception 'Je kunt alleen je eigen materiaal verwerken.'; end if;
    if not public.upt_feature_allowed('inventory',v_issue.event_id,v_issue.workplace_id) then raise exception 'Materiaal is niet beschikbaar.'; end if;
    if not exists(
      select 1 from public.upt_current_work_context() ctx
      where ctx.event_id=v_issue.event_id
        and ctx.workplace_id=v_issue.workplace_id
    ) then raise exception 'Materiaal kan alleen tijdens je actieve shift op deze werkplek worden verwerkt.'; end if;
  end if;

  if p_quantity>v_issue.outstanding_quantity then raise exception 'Hoeveelheid is groter dan wat nog uitstaat.'; end if;

  v_remaining:=v_issue.outstanding_quantity-p_quantity;

  update public.inventory_items
  set issued_quantity=issued_quantity-p_quantity,
      available_quantity=available_quantity+case when p_condition='returned' then p_quantity else 0 end,
      damaged_quantity=damaged_quantity+case when p_condition='damaged' then p_quantity else 0 end,
      missing_quantity=missing_quantity+case when p_condition='missing' then p_quantity else 0 end,
      updated_at=now()
  where id=v_item.id;

  update public.inventory_issues
  set outstanding_quantity=v_remaining,
      closed_at=case when v_remaining=0 then now() else null end,
      updated_at=now()
  where id=p_issue;

  insert into public.inventory_movements(
    item_id,issue_id,event_id,workplace_id,actor_id,target_user_id,movement_type,quantity,notes
  )
  values(
    v_item.id,p_issue,v_issue.event_id,v_issue.workplace_id,v_actor,v_issue.user_id,p_condition,p_quantity,v_notes
  );

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.'||p_condition,'inventory_issue',p_issue,jsonb_build_object(
    'item_id',v_item.id,'user_id',v_issue.user_id,'quantity',p_quantity,'remaining',v_remaining
  ));

  if p_condition in ('damaged','missing') then
    insert into public.crew_notifications(user_id,title,body,link,kind)
    select distinct x.user_id,
      case when p_condition='damaged' then 'Materiaal beschadigd' else 'Materiaal vermist' end,
      trim(v_item.name)||' · '||p_quantity::text||' stuk(s)',
      '/workplaces',
      'inventory'
    from (
      select ra.user_id
      from public.responsible_assignments ra
      where ra.event_id=v_issue.event_id
        and ra.workplace_id=v_issue.workplace_id
      union
      select p.id
      from public.profiles p
      where p.approved=true and p.role='admin'
    ) x
    where x.user_id<>v_actor;
  end if;
end;
$function$;

revoke all on function public.upt_settle_inventory_issue(uuid,text,integer,text)
from public,anon;
grant execute on function public.upt_settle_inventory_issue(uuid,text,integer,text)
to authenticated;

create or replace function public.upt_restore_inventory_quantity(
  p_item uuid,
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
  v_available integer;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_condition not in ('damaged','missing') then raise exception 'Alleen beschadigd of vermist materiaal kan worden hersteld.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100000 then raise exception 'Ongeldige hoeveelheid.'; end if;

  select * into v_item
  from public.inventory_items
  where id=p_item
  for update;
  if not found or not v_item.is_active then raise exception 'Materiaal niet gevonden.'; end if;
  if not upt_private.inventory_can_manage(v_item.event_id,v_item.workplace_id) then raise exception 'Geen toegang.'; end if;

  v_available:=case when p_condition='damaged' then v_item.damaged_quantity else v_item.missing_quantity end;
  if p_quantity>v_available then raise exception 'Hoeveelheid is groter dan de geregistreerde status.'; end if;

  update public.inventory_items
  set available_quantity=available_quantity+p_quantity,
      damaged_quantity=damaged_quantity-case when p_condition='damaged' then p_quantity else 0 end,
      missing_quantity=missing_quantity-case when p_condition='missing' then p_quantity else 0 end,
      updated_at=now()
  where id=p_item;

  insert into public.inventory_movements(
    item_id,event_id,workplace_id,actor_id,movement_type,quantity,notes
  )
  values(
    p_item,v_item.event_id,v_item.workplace_id,v_actor,
    case when p_condition='damaged' then 'restored-damaged' else 'restored-missing' end,
    p_quantity,v_notes
  );

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.restored','inventory_item',p_item,jsonb_build_object(
    'from',p_condition,'quantity',p_quantity
  ));
end;
$function$;

revoke all on function public.upt_restore_inventory_quantity(uuid,text,integer,text)
from public,anon;
grant execute on function public.upt_restore_inventory_quantity(uuid,text,integer,text)
to authenticated;

create or replace function public.upt_inventory_health()
returns table(
  event_id uuid,
  workplace_id uuid,
  item_count integer,
  total_quantity integer,
  available_quantity integer,
  issued_quantity integer,
  damaged_quantity integer,
  missing_quantity integer,
  low_stock_count integer
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select
    i.event_id,
    i.workplace_id,
    count(*)::integer,
    coalesce(sum(i.total_quantity),0)::integer,
    coalesce(sum(i.available_quantity),0)::integer,
    coalesce(sum(i.issued_quantity),0)::integer,
    coalesce(sum(i.damaged_quantity),0)::integer,
    coalesce(sum(i.missing_quantity),0)::integer,
    count(*) filter(
      where i.available_quantity<=0
        or (i.total_quantity>0 and i.available_quantity::numeric/i.total_quantity<=0.2)
    )::integer
  from public.inventory_items i
  where i.is_active=true
    and upt_private.inventory_can_view(i.event_id,i.workplace_id)
  group by i.event_id,i.workplace_id
  order by i.event_id,i.workplace_id;
$$;

revoke all on function public.upt_inventory_health()
from public,anon;
grant execute on function public.upt_inventory_health()
to authenticated;

alter table upt_private.shift_handovers
add column if not exists inventory_snapshot jsonb not null default '{}'::jsonb;

create or replace function upt_private.capture_handover_inventory_snapshot()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
begin
  if new.status='ready' then
    select jsonb_build_object(
      'item_count',count(*)::integer,
      'total_quantity',coalesce(sum(i.total_quantity),0)::integer,
      'available_quantity',coalesce(sum(i.available_quantity),0)::integer,
      'issued_quantity',coalesce(sum(i.issued_quantity),0)::integer,
      'damaged_quantity',coalesce(sum(i.damaged_quantity),0)::integer,
      'missing_quantity',coalesce(sum(i.missing_quantity),0)::integer,
      'low_stock_count',count(*) filter(
        where i.available_quantity<=0
          or (i.total_quantity>0 and i.available_quantity::numeric/i.total_quantity<=0.2)
      )::integer,
      'captured_at',now()
    )
    into new.inventory_snapshot
    from public.inventory_items i
    where i.event_id=new.event_id
      and i.workplace_id=new.workplace_id
      and i.is_active=true;
  elsif new.status='draft' then
    new.inventory_snapshot:='{}'::jsonb;
  end if;
  return new;
end;
$function$;

revoke all on function upt_private.capture_handover_inventory_snapshot()
from public,anon,authenticated;

drop trigger if exists shift_handover_inventory_snapshot on upt_private.shift_handovers;
create trigger shift_handover_inventory_snapshot
before insert or update of status,updated_at
on upt_private.shift_handovers
for each row
execute function upt_private.capture_handover_inventory_snapshot();

create or replace function public.upt_shift_handover_inventory_snapshots()
returns table(
  handover_id uuid,
  inventory_snapshot jsonb
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select h.id,h.inventory_snapshot
  from upt_private.shift_handovers h
  where public.upt_is_approved()
    and (
      public.upt_is_admin((select auth.uid()))
      or h.outgoing_responsible_id=(select auth.uid())
      or h.incoming_responsible_id=(select auth.uid())
    )
  order by h.updated_at desc;
$$;

revoke all on function public.upt_shift_handover_inventory_snapshots()
from public,anon;
grant execute on function public.upt_shift_handover_inventory_snapshots()
to authenticated;

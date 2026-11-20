create table if not exists public.inventory_settlement_requests (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.inventory_issues(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  condition text not null check (condition in ('returned','damaged','missing')),
  quantity integer not null check (quantity > 0),
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid references public.profiles(id) on delete set null,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status='pending') = (decided_at is null))
);

create unique index if not exists inventory_settlement_requests_issue_pending_unique
on public.inventory_settlement_requests(issue_id)
where status='pending';

create index if not exists inventory_settlement_requests_user_idx
on public.inventory_settlement_requests(user_id,status,created_at desc);

create index if not exists inventory_settlement_requests_event_workplace_idx
on public.inventory_settlement_requests(event_id,workplace_id,status,created_at desc);

create index if not exists inventory_settlement_requests_decided_by_idx
on public.inventory_settlement_requests(decided_by)
where decided_by is not null;

alter table public.inventory_settlement_requests enable row level security;
revoke all on table public.inventory_settlement_requests from anon;
revoke insert,update,delete on table public.inventory_settlement_requests from authenticated;
grant select on table public.inventory_settlement_requests to authenticated;

drop policy if exists inventory_issues_read on public.inventory_issues;
create policy inventory_issues_read
on public.inventory_issues
for select
to authenticated
using (
  public.upt_is_approved()
  and public.upt_feature_allowed('inventory',event_id,workplace_id)
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
  and public.upt_feature_allowed('inventory',event_id,workplace_id)
  and (
    target_user_id=(select auth.uid())
    or upt_private.inventory_can_manage(event_id,workplace_id)
  )
);

drop policy if exists inventory_settlement_requests_read on public.inventory_settlement_requests;
create policy inventory_settlement_requests_read
on public.inventory_settlement_requests
for select
to authenticated
using (
  public.upt_is_approved()
  and public.upt_feature_allowed('inventory',event_id,workplace_id)
  and (
    user_id=(select auth.uid())
    or upt_private.inventory_can_manage(event_id,workplace_id)
  )
);

create or replace function upt_private.apply_inventory_settlement(
  p_issue uuid,
  p_condition text,
  p_quantity integer,
  p_notes text,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_issue public.inventory_issues%rowtype;
  v_item public.inventory_items%rowtype;
  v_remaining integer;
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
begin
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
    v_item.id,p_issue,v_issue.event_id,v_issue.workplace_id,p_actor,v_issue.user_id,p_condition,p_quantity,v_notes
  );

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_actor,'inventory.'||p_condition,'inventory_issue',p_issue,jsonb_build_object(
    'item_id',v_item.id,'user_id',v_issue.user_id,'quantity',p_quantity,'remaining',v_remaining
  ));
end;
$function$;

revoke all on function upt_private.apply_inventory_settlement(uuid,text,integer,text,uuid)
from public,anon,authenticated;

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
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;

  select * into v_issue
  from public.inventory_issues
  where id=p_issue;
  if not found then raise exception 'Uitgifte niet gevonden.'; end if;
  if not upt_private.inventory_can_manage(v_issue.event_id,v_issue.workplace_id) then
    raise exception 'Alleen admin of de verantwoordelijke kan voorraad definitief verwerken.';
  end if;

  perform upt_private.apply_inventory_settlement(p_issue,p_condition,p_quantity,p_notes,v_actor);
end;
$function$;

revoke all on function public.upt_settle_inventory_issue(uuid,text,integer,text)
from public,anon;
grant execute on function public.upt_settle_inventory_issue(uuid,text,integer,text)
to authenticated;

create or replace function public.upt_request_inventory_settlement(
  p_issue uuid,
  p_condition text,
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
  v_issue public.inventory_issues%rowtype;
  v_item public.inventory_items%rowtype;
  v_request uuid;
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_condition not in ('returned','damaged','missing') then raise exception 'Ongeldige materiaalstatus.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100000 then raise exception 'Ongeldige hoeveelheid.'; end if;

  select * into v_issue
  from public.inventory_issues
  where id=p_issue
  for update;
  if not found or v_issue.outstanding_quantity<=0 then raise exception 'Uitgifte is al volledig verwerkt.'; end if;
  if v_issue.user_id<>v_actor then raise exception 'Je kunt alleen je eigen materiaal melden.'; end if;
  if p_quantity>v_issue.outstanding_quantity then raise exception 'Hoeveelheid is groter dan wat nog uitstaat.'; end if;
  if not public.upt_feature_allowed('inventory',v_issue.event_id,v_issue.workplace_id) then raise exception 'Materiaal is niet beschikbaar.'; end if;
  if not exists(
    select 1
    from public.upt_current_work_context() ctx
    where ctx.event_id=v_issue.event_id
      and ctx.workplace_id=v_issue.workplace_id
  ) then raise exception 'Materiaal kan alleen tijdens je actieve shift op deze werkplek worden gemeld.'; end if;

  select * into v_item from public.inventory_items where id=v_issue.item_id;
  if not found then raise exception 'Materiaal niet gevonden.'; end if;

  begin
    insert into public.inventory_settlement_requests(
      issue_id,event_id,workplace_id,user_id,condition,quantity,notes
    )
    values(
      p_issue,v_issue.event_id,v_issue.workplace_id,v_actor,p_condition,p_quantity,v_notes
    )
    returning id into v_request;
  exception when unique_violation then
    raise exception 'Er staat al een materiaalverzoek open voor deze uitgifte.';
  end;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.settlement.requested','inventory_settlement_request',v_request,jsonb_build_object(
    'issue_id',p_issue,'condition',p_condition,'quantity',p_quantity
  ));

  insert into public.crew_notifications(user_id,title,body,link,kind)
  select distinct x.user_id,
    case when p_condition='returned' then 'Materiaalretour gemeld'
         when p_condition='damaged' then 'Beschadigd materiaal gemeld'
         else 'Vermist materiaal gemeld' end,
    trim(v_item.name)||' · '||p_quantity::text||' stuk(s)',
    '/workplaces',
    'inventory'
  from (
    select ra.user_id
    from public.responsible_assignments ra
    where ra.event_id=v_issue.event_id
      and ra.workplace_id=v_issue.workplace_id
    union
    select p.id from public.profiles p where p.approved=true and p.role='admin'
  ) x
  where x.user_id<>v_actor;

  return v_request;
end;
$function$;

revoke all on function public.upt_request_inventory_settlement(uuid,text,integer,text)
from public,anon;
grant execute on function public.upt_request_inventory_settlement(uuid,text,integer,text)
to authenticated;

create or replace function public.upt_cancel_inventory_settlement(p_request uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_request public.inventory_settlement_requests%rowtype;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;

  select * into v_request
  from public.inventory_settlement_requests
  where id=p_request
  for update;
  if not found then raise exception 'Materiaalverzoek niet gevonden.'; end if;
  if v_request.user_id<>v_actor then raise exception 'Je kunt alleen je eigen verzoek annuleren.'; end if;
  if v_request.status<>'pending' then raise exception 'Dit verzoek is niet meer actief.'; end if;

  update public.inventory_settlement_requests
  set status='cancelled',decided_at=now(),updated_at=now(),decision_note='Geannuleerd door medewerker.'
  where id=p_request;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.settlement.cancelled','inventory_settlement_request',p_request,'{}'::jsonb);
end;
$function$;

revoke all on function public.upt_cancel_inventory_settlement(uuid)
from public,anon;
grant execute on function public.upt_cancel_inventory_settlement(uuid)
to authenticated;

create or replace function public.upt_decide_inventory_settlement(
  p_request uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_request public.inventory_settlement_requests%rowtype;
  v_item public.inventory_items%rowtype;
  v_note text:=nullif(trim(coalesce(p_note,'')),'');
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Ongeldige beslissing.'; end if;
  if p_decision='rejected' and (v_note is null or length(v_note)<3) then raise exception 'Geef een reden voor de afwijzing.'; end if;

  select * into v_request
  from public.inventory_settlement_requests
  where id=p_request
  for update;
  if not found then raise exception 'Materiaalverzoek niet gevonden.'; end if;
  if v_request.status<>'pending' then raise exception 'Dit verzoek is niet meer actief.'; end if;
  if not upt_private.inventory_can_manage(v_request.event_id,v_request.workplace_id) then raise exception 'Geen toegang.'; end if;

  select i.* into v_item
  from public.inventory_issues issue
  join public.inventory_items i on i.id=issue.item_id
  where issue.id=v_request.issue_id;
  if not found then raise exception 'Materiaal niet gevonden.'; end if;

  if p_decision='approved' then
    perform upt_private.apply_inventory_settlement(
      v_request.issue_id,v_request.condition,v_request.quantity,v_request.notes,v_actor
    );
  end if;

  update public.inventory_settlement_requests
  set status=p_decision,
      decided_by=v_actor,
      decided_at=now(),
      decision_note=v_note,
      updated_at=now()
  where id=p_request;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.settlement.'||p_decision,'inventory_settlement_request',p_request,jsonb_build_object(
    'issue_id',v_request.issue_id,'condition',v_request.condition,'quantity',v_request.quantity,'note',v_note
  ));

  insert into public.crew_notifications(user_id,title,body,link,kind)
  values(
    v_request.user_id,
    case when p_decision='approved' then 'Materiaalmelding bevestigd' else 'Materiaalmelding afgewezen' end,
    trim(v_item.name)||' · '||v_request.quantity::text||' stuk(s)'||
      case when v_note is not null then ' · '||v_note else '' end,
    '/tasks',
    'inventory'
  );
end;
$function$;

revoke all on function public.upt_decide_inventory_settlement(uuid,text,text)
from public,anon;
grant execute on function public.upt_decide_inventory_settlement(uuid,text,text)
to authenticated;

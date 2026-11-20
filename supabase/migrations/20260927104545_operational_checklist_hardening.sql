drop policy if exists operational_checklists_read on public.operational_checklists;
create policy operational_checklists_read
on public.operational_checklists
for select
to authenticated
using (
  public.upt_is_approved()
  and (
    public.upt_is_admin(auth.uid())
    or (
      public.upt_feature_allowed('tasks',event_id,workplace_id)
      and (
        public.upt_is_responsible(event_id,workplace_id,auth.uid())
        or exists(
          select 1
          from public.upt_current_work_context() ctx
          where ctx.event_id=operational_checklists.event_id
            and ctx.workplace_id=operational_checklists.workplace_id
        )
      )
    )
  )
);

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
  v_workplace_name text;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_kind not in ('opening','closing','safety','custom') then raise exception 'Ongeldig checklisttype.'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 200 then raise exception 'Geef een geldige checklistnaam.'; end if;

  select w.name
  into v_workplace_name
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

  insert into public.crew_notifications(user_id,title,body,link,kind)
  select distinct
    s.user_id,
    'Nieuwe operationele checklist',
    trim(p_title)||' · '||v_workplace_name,
    '/tasks',
    'checklist'
  from public.shifts s
  join public.profiles p on p.id=s.user_id and p.approved=true
  where s.event_id=p_event
    and s.workplace_id=p_workplace
    and s.status<>'cancelled'
    and s.response_status<>'declined'
    and s.scheduled_end>now()
    and s.user_id<>v_actor;

  return v_id;
end;
$function$;

revoke all on function public.upt_create_operational_checklist(uuid,uuid,text,text,text)
from public,anon;
grant execute on function public.upt_create_operational_checklist(uuid,uuid,text,text,text)
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

  if not public.upt_is_admin(v_actor) then
    if not public.upt_is_responsible(v_checklist.event_id,v_checklist.workplace_id,v_actor) then
      raise exception 'Geen toegang.';
    end if;
    if not public.upt_feature_allowed('tasks',v_checklist.event_id,v_checklist.workplace_id) then
      raise exception 'Checklists zijn voor jouw rol op dit moment niet beschikbaar.';
    end if;
  end if;

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
  if v_checklist.status<>'open' then raise exception 'Checklist is al afgerond.'; end if;

  if not public.upt_is_admin(v_actor) then
    if not public.upt_is_responsible(v_checklist.event_id,v_checklist.workplace_id,v_actor) then
      raise exception 'Alleen admin of de verantwoordelijke kan een checklist afsluiten.';
    end if;
    if not public.upt_feature_allowed('tasks',v_checklist.event_id,v_checklist.workplace_id) then
      raise exception 'Checklists zijn voor jouw rol op dit moment niet beschikbaar.';
    end if;
  end if;

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
  if v_checklist.status<>'completed' then raise exception 'Alleen een afgeronde checklist kan worden heropend.'; end if;

  if not public.upt_is_admin(v_actor) then
    if not public.upt_is_responsible(v_checklist.event_id,v_checklist.workplace_id,v_actor) then
      raise exception 'Alleen admin of de verantwoordelijke kan een checklist heropenen.';
    end if;
    if not public.upt_feature_allowed('tasks',v_checklist.event_id,v_checklist.workplace_id) then
      raise exception 'Checklists zijn voor jouw rol op dit moment niet beschikbaar.';
    end if;
  end if;

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

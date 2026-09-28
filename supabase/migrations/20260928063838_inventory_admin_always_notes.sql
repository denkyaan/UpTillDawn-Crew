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
as $fn$
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
  where w.id=p_workplace
    and w.is_active=true
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
$fn$;

revoke all on function public.upt_create_workplace_inventory_note(uuid,text,text,text)
from public,anon;
grant execute on function public.upt_create_workplace_inventory_note(uuid,text,text,text)
to authenticated;

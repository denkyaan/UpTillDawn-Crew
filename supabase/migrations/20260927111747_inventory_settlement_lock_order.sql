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
  v_pending_request uuid;
  v_pending_user uuid;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;

  select * into v_issue
  from public.inventory_issues
  where id=p_issue;
  if not found then raise exception 'Uitgifte niet gevonden.'; end if;
  if not upt_private.inventory_can_manage(v_issue.event_id,v_issue.workplace_id) then
    raise exception 'Alleen admin of de verantwoordelijke kan voorraad definitief verwerken.';
  end if;

  select id,user_id
  into v_pending_request,v_pending_user
  from public.inventory_settlement_requests
  where issue_id=p_issue
    and status='pending'
  for update;

  perform upt_private.apply_inventory_settlement(p_issue,p_condition,p_quantity,p_notes,v_actor);

  if v_pending_request is not null then
    update public.inventory_settlement_requests
    set status='rejected',
        decided_by=v_actor,
        decided_at=now(),
        decision_note='Voorraad rechtstreeks verwerkt door manager.',
        updated_at=now()
    where id=v_pending_request;

    insert into public.crew_notifications(user_id,title,body,link,kind)
    values(
      v_pending_user,
      'Materiaalmelding vervangen',
      'Responsible of Admin heeft de materiaaluitgifte rechtstreeks verwerkt.',
      '/tasks',
      'inventory'
    );
  end if;
end;
$function$;

revoke all on function public.upt_settle_inventory_issue(uuid,text,integer,text)
from public,anon;
grant execute on function public.upt_settle_inventory_issue(uuid,text,integer,text)
to authenticated;

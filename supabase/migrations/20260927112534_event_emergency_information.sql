insert into public.role_ui_rules(role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings)
values
  ('admin','emergency','Noodinformatie','operations',true,true,'always',115,'{}'::jsonb),
  ('responsible_lead','emergency','Noodinformatie','operations',true,true,'assigned_event',115,'{}'::jsonb),
  ('staff','emergency','Noodinformatie','operations',true,true,'assigned_event',115,'{}'::jsonb)
on conflict (role,feature_key) do nothing;

create table if not exists public.event_emergency_information (
  event_id uuid primary key references public.events(id) on delete cascade,
  emergency_number text not null default '112' check (length(trim(emergency_number)) between 2 and 40),
  first_aid_contact text,
  security_contact text,
  assembly_point text,
  procedure text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists event_emergency_information_updated_by_idx
on public.event_emergency_information(updated_by)
where updated_by is not null;

alter table public.event_emergency_information enable row level security;

revoke all on table public.event_emergency_information from anon;
revoke insert,update,delete on table public.event_emergency_information from authenticated;
grant select on table public.event_emergency_information to authenticated;

drop policy if exists event_emergency_information_read on public.event_emergency_information;
create policy event_emergency_information_read
on public.event_emergency_information
for select
to authenticated
using (
  public.upt_is_approved()
  and public.upt_feature_allowed('emergency',event_id,null)
  and (
    public.upt_is_admin((select auth.uid()))
    or exists(
      select 1
      from public.event_members em
      join public.events e on e.id=em.event_id
      where em.event_id=event_emergency_information.event_id
        and em.user_id=(select auth.uid())
        and (e.status is null or e.status <> 'archived')
        and now()<=e.end_at + interval '3 days'
    )
    or exists(
      select 1
      from public.shifts s
      join public.events e on e.id=s.event_id
      where s.event_id=event_emergency_information.event_id
        and s.user_id=(select auth.uid())
        and s.status<>'cancelled'
        and s.response_status<>'declined'
        and (e.status is null or e.status <> 'archived')
        and now()<=e.end_at + interval '3 days'
    )
    or exists(
      select 1
      from public.responsible_assignments ra
      join public.events e on e.id=ra.event_id
      where ra.event_id=event_emergency_information.event_id
        and ra.user_id=(select auth.uid())
        and (e.status is null or e.status <> 'archived')
        and now()<=e.end_at + interval '3 days'
    )
  )
);

create or replace function public.upt_upsert_event_emergency_information(
  p_event uuid,
  p_emergency_number text,
  p_first_aid_contact text default null,
  p_security_contact text default null,
  p_assembly_point text default null,
  p_procedure text default null
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_emergency text:=trim(coalesce(p_emergency_number,''));
  v_first_aid text:=nullif(trim(coalesce(p_first_aid_contact,'')),'');
  v_security text:=nullif(trim(coalesce(p_security_contact,'')),'');
  v_assembly text:=nullif(trim(coalesce(p_assembly_point,'')),'');
  v_procedure text:=nullif(trim(coalesce(p_procedure,'')),'');
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan noodinformatie wijzigen.'; end if;
  if not public.upt_feature_allowed('emergency',p_event,null) then raise exception 'Noodinformatie is uitgeschakeld.'; end if;
  if length(v_emergency) not between 2 and 40 then raise exception 'Geef een geldig noodnummer.'; end if;
  if length(coalesce(v_first_aid,''))>300 or length(coalesce(v_security,''))>300 or length(coalesce(v_assembly,''))>500 or length(coalesce(v_procedure,''))>5000 then
    raise exception 'Noodinformatie is te lang.';
  end if;

  perform 1
  from public.events e
  where e.id=p_event
    and (e.status is null or e.status <> 'archived')
    and now()<=e.end_at + interval '3 days'
  for update;
  if not found then raise exception 'Evenement is niet beschikbaar.'; end if;

  insert into public.event_emergency_information(
    event_id,emergency_number,first_aid_contact,security_contact,assembly_point,procedure,updated_by,updated_at
  )
  values(
    p_event,v_emergency,v_first_aid,v_security,v_assembly,v_procedure,v_actor,now()
  )
  on conflict (event_id) do update
  set emergency_number=excluded.emergency_number,
      first_aid_contact=excluded.first_aid_contact,
      security_contact=excluded.security_contact,
      assembly_point=excluded.assembly_point,
      procedure=excluded.procedure,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'emergency_information.updated','event',p_event,jsonb_build_object(
    'has_first_aid',v_first_aid is not null,
    'has_security',v_security is not null,
    'has_assembly_point',v_assembly is not null,
    'has_procedure',v_procedure is not null
  ));

  insert into public.crew_notifications(user_id,title,body,link,kind)
  select distinct target.user_id,
    'Noodinformatie bijgewerkt',
    e.name||' · controleer de actuele veiligheidsinformatie.',
    '/events',
    'emergency'
  from public.events e
  cross join lateral (
    select em.user_id from public.event_members em where em.event_id=p_event
    union
    select s.user_id from public.shifts s where s.event_id=p_event and s.status<>'cancelled' and s.response_status<>'declined'
    union
    select ra.user_id from public.responsible_assignments ra where ra.event_id=p_event
  ) target
  join public.profiles p on p.id=target.user_id and p.approved=true
  where e.id=p_event
    and target.user_id<>v_actor;
end;
$function$;

revoke all on function public.upt_upsert_event_emergency_information(uuid,text,text,text,text,text)
from public,anon;
grant execute on function public.upt_upsert_event_emergency_information(uuid,text,text,text,text,text)
to authenticated;

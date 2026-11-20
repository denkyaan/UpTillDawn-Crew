create or replace function upt_private.document_view_role(
  p_event uuid,
  p_workplace uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_user uuid:=auth.uid();
begin
  if v_user is null or not public.upt_is_approved() then return null; end if;
  if public.upt_is_admin(v_user) then return 'admin'; end if;

  if exists(
    select 1
    from public.responsible_assignments ra
    where ra.event_id=p_event
      and ra.user_id=v_user
      and (p_workplace is null or ra.workplace_id=p_workplace)
  ) then return 'responsible'; end if;

  if p_workplace is null and exists(
    select 1
    from public.event_members em
    where em.event_id=p_event
      and em.user_id=v_user
  ) then return 'employee'; end if;

  if exists(
    select 1
    from public.shifts s
    where s.event_id=p_event
      and s.user_id=v_user
      and s.status<>'cancelled'
      and s.response_status<>'declined'
      and (p_workplace is null or s.workplace_id=p_workplace)
  ) then return 'employee'; end if;

  return null;
end;
$function$;

revoke all on function upt_private.document_view_role(uuid,uuid)
from public,anon;
grant execute on function upt_private.document_view_role(uuid,uuid)
to authenticated;

create or replace function public.upt_create_event_document(
  p_event uuid,
  p_workplace uuid,
  p_kind text,
  p_audience text,
  p_title text,
  p_description text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_offline_critical boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_id uuid;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_kind not in ('briefing','safety','map','procedure','permit','technical','crew') then raise exception 'Ongeldig documenttype.'; end if;
  if p_audience not in ('employee','responsible','admin') then raise exception 'Ongeldige doelgroep.'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 200 then raise exception 'Geef een geldige documentnaam.'; end if;
  if length(coalesce(p_description,''))>2000 then raise exception 'Omschrijving is te lang.'; end if;
  if p_file_name is null or length(trim(p_file_name)) not between 1 and 255 then raise exception 'Ongeldige bestandsnaam.'; end if;
  if p_file_size_bytes is null or p_file_size_bytes<=0 or p_file_size_bytes>52428800 then raise exception 'Ongeldige bestandsgrootte.'; end if;
  if p_storage_path is null or split_part(p_storage_path,'/',1)<>v_actor::text or split_part(p_storage_path,'/',2)<>'document' then
    raise exception 'Ongeldig opslagpad.';
  end if;

  perform 1
  from public.events e
  where e.id=p_event
    and coalesce(e.status,'')<>'archived'
    and now()<=e.end_at + interval '3 days'
  for update;
  if not found then raise exception 'Evenement is niet beschikbaar.'; end if;

  if p_workplace is not null and not exists(
    select 1 from public.workplaces w
    where w.id=p_workplace and w.event_id=p_event and w.is_active=true
  ) then raise exception 'Werkplek behoort niet tot dit evenement.'; end if;

  if not upt_private.document_can_manage(p_event,p_workplace) then
    raise exception 'Geen toegang tot documentbeheer.';
  end if;

  if not exists(
    select 1 from storage.objects o
    where o.bucket_id='work-media'
      and o.name=p_storage_path
  ) then raise exception 'Bestand is niet aanwezig in opslag.'; end if;

  insert into public.event_documents(
    event_id,workplace_id,kind,audience,title,description,storage_path,file_name,mime_type,file_size_bytes,offline_critical,uploaded_by
  )
  values(
    p_event,p_workplace,p_kind,p_audience,trim(p_title),nullif(trim(coalesce(p_description,'')),''),
    p_storage_path,trim(p_file_name),p_mime_type,p_file_size_bytes,coalesce(p_offline_critical,false),v_actor
  )
  returning id into v_id;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'event_document.created','event_document',v_id,jsonb_build_object(
    'event_id',p_event,
    'workplace_id',p_workplace,
    'kind',p_kind,
    'audience',p_audience,
    'offline_critical',coalesce(p_offline_critical,false)
  ));

  insert into public.crew_notifications(user_id,title,body,link,kind)
  select distinct target.user_id,
    case when coalesce(p_offline_critical,false) then 'Nieuw belangrijk document' else 'Nieuw evenementdocument' end,
    trim(p_title),
    '/events',
    'document'
  from (
    select p.id as user_id,
      case
        when p.role='admin' then 3
        when exists(
          select 1 from public.responsible_assignments ra
          where ra.event_id=p_event
            and ra.user_id=p.id
            and (p_workplace is null or ra.workplace_id=p_workplace)
        ) then 2
        when (
          (p_workplace is null and exists(
            select 1 from public.event_members em
            where em.event_id=p_event and em.user_id=p.id
          ))
          or exists(
            select 1 from public.shifts s
            where s.event_id=p_event
              and s.user_id=p.id
              and s.status<>'cancelled'
              and s.response_status<>'declined'
              and (p_workplace is null or s.workplace_id=p_workplace)
          )
        ) then 1
        else 0
      end as role_rank
    from public.profiles p
    where p.approved=true
  ) target
  where target.user_id<>v_actor
    and target.role_rank >= upt_private.document_role_rank(p_audience);

  return v_id;
end;
$function$;

revoke all on function public.upt_create_event_document(uuid,uuid,text,text,text,text,text,text,text,bigint,boolean)
from public,anon;
grant execute on function public.upt_create_event_document(uuid,uuid,text,text,text,text,text,text,text,bigint,boolean)
to authenticated;

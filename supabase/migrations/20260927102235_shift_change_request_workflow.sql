create table if not exists upt_private.shift_change_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('swap','replacement','claim-open-shift')),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  target_shift_id uuid references public.shifts(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  replacement_user_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  replacement_response text not null default 'pending' check (replacement_response in ('pending','accepted','declined','not-required')),
  reason text not null check (length(trim(reason)) between 3 and 500),
  decision_reason text,
  source_revision_at timestamptz not null,
  target_revision_at timestamptz,
  replacement_responded_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (type='replacement' and replacement_user_id is not null and target_shift_id is null)
    or (type='swap' and replacement_user_id is not null and target_shift_id is not null)
    or (type='claim-open-shift' and replacement_user_id is not null and target_shift_id is null)
  )
);

alter table upt_private.shift_change_requests enable row level security;

drop policy if exists shift_change_requests_no_direct_access
on upt_private.shift_change_requests;

create policy shift_change_requests_no_direct_access
on upt_private.shift_change_requests
as restrictive
for all
to public
using (false)
with check (false);

revoke all on table upt_private.shift_change_requests
from public,anon,authenticated;

create unique index if not exists shift_change_requests_requester_open_idx
on upt_private.shift_change_requests(shift_id,requester_id)
where status='pending';

create index if not exists shift_change_requests_replacement_idx
on upt_private.shift_change_requests(replacement_user_id,status,updated_at desc);

create index if not exists shift_change_requests_target_shift_idx
on upt_private.shift_change_requests(target_shift_id)
where target_shift_id is not null;

create index if not exists shift_change_requests_event_workplace_idx
on upt_private.shift_change_requests(event_id,workplace_id,status,updated_at desc);

create or replace function upt_private.user_available_for_shift(
  p_user uuid,
  p_event uuid,
  p_shift_kind text
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select exists(
    select 1
    from public.event_members em
    join public.profiles p on p.id=em.user_id and p.approved=true
    join public.event_availability ea on ea.event_id=em.event_id and ea.user_id=em.user_id
    where em.event_id=p_event
      and em.user_id=p_user
      and (
        (p_shift_kind='event' and ea.response='can')
        or (p_shift_kind='setup' and ea.setup_available=true)
        or (p_shift_kind='breakdown' and ea.breakdown_available=true)
      )
  );
$$;

revoke all on function upt_private.user_available_for_shift(uuid,uuid,text)
from public,anon,authenticated;

create or replace function upt_private.user_has_shift_overlap(
  p_user uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_shift uuid default null,
  p_exclude_shift_two uuid default null
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select exists(
    select 1
    from public.shifts s
    where s.user_id=p_user
      and s.status<>'cancelled'
      and s.response_status<>'declined'
      and (p_exclude_shift is null or s.id<>p_exclude_shift)
      and (p_exclude_shift_two is null or s.id<>p_exclude_shift_two)
      and s.scheduled_start<p_end
      and s.scheduled_end>p_start
  );
$$;

revoke all on function upt_private.user_has_shift_overlap(uuid,timestamptz,timestamptz,uuid,uuid)
from public,anon,authenticated;

create or replace function public.upt_shift_change_candidates(p_shift uuid)
returns table(
  user_id uuid,
  full_name text
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  with source as (
    select s.*
    from public.shifts s
    where s.id=p_shift
      and s.user_id=auth.uid()
      and s.status<>'cancelled'
      and s.scheduled_start>now()
  )
  select p.id,p.full_name
  from source s
  join public.event_members em on em.event_id=s.event_id
  join public.profiles p on p.id=em.user_id and p.approved=true
  where public.upt_is_approved()
    and p.id<>auth.uid()
    and upt_private.user_available_for_shift(p.id,s.event_id,s.shift_kind)
    and (
      s.overlap_allowed=true
      or not upt_private.user_has_shift_overlap(
        p.id,s.scheduled_start,s.scheduled_end,s.id,null
      )
    )
  order by p.full_name nulls last,p.id;
$$;

revoke all on function public.upt_shift_change_candidates(uuid) from public,anon;
grant execute on function public.upt_shift_change_candidates(uuid) to authenticated;

create or replace function public.upt_swap_candidates(p_shift uuid)
returns table(
  target_shift_id uuid,
  user_id uuid,
  full_name text,
  workplace_name text,
  role_name text,
  scheduled_start timestamptz,
  scheduled_end timestamptz
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  with source as (
    select s.*
    from public.shifts s
    where s.id=p_shift
      and s.user_id=auth.uid()
      and s.status<>'cancelled'
      and s.response_status<>'declined'
      and s.scheduled_start>now()
  )
  select
    target.id,
    target.user_id,
    p.full_name,
    w.name,
    target.role_name,
    target.scheduled_start,
    target.scheduled_end
  from source source_shift
  join public.shifts target
    on target.event_id=source_shift.event_id
   and target.id<>source_shift.id
   and target.user_id<>auth.uid()
   and target.status<>'cancelled'
   and target.response_status<>'declined'
   and target.scheduled_start>now()
  join public.profiles p on p.id=target.user_id and p.approved=true
  join public.workplaces w on w.id=target.workplace_id
  where public.upt_is_approved()
    and upt_private.user_available_for_shift(target.user_id,source_shift.event_id,source_shift.shift_kind)
    and upt_private.user_available_for_shift(auth.uid(),target.event_id,target.shift_kind)
    and (
      source_shift.overlap_allowed=true
      or not upt_private.user_has_shift_overlap(
        target.user_id,source_shift.scheduled_start,source_shift.scheduled_end,
        source_shift.id,target.id
      )
    )
    and (
      target.overlap_allowed=true
      or not upt_private.user_has_shift_overlap(
        auth.uid(),target.scheduled_start,target.scheduled_end,
        source_shift.id,target.id
      )
    )
  order by target.scheduled_start,p.full_name nulls last,target.id;
$$;

revoke all on function public.upt_swap_candidates(uuid) from public,anon;
grant execute on function public.upt_swap_candidates(uuid) to authenticated;

create or replace function public.upt_claimable_shifts()
returns table(
  shift_id uuid,
  event_id uuid,
  event_name text,
  workplace_id uuid,
  workplace_name text,
  role_name text,
  shift_kind text,
  scheduled_start timestamptz,
  scheduled_end timestamptz
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select
    s.id,
    s.event_id,
    e.name,
    s.workplace_id,
    w.name,
    s.role_name,
    s.shift_kind,
    s.scheduled_start,
    s.scheduled_end
  from public.shifts s
  join public.events e on e.id=s.event_id
  join public.workplaces w on w.id=s.workplace_id
  join public.event_members em on em.event_id=s.event_id and em.user_id=auth.uid()
  where public.upt_is_approved()
    and s.user_id<>auth.uid()
    and s.status<>'cancelled'
    and s.response_status='declined'
    and s.scheduled_start>now()
    and coalesce(e.status,'')<>'archived'
    and upt_private.user_available_for_shift(auth.uid(),s.event_id,s.shift_kind)
    and (
      s.overlap_allowed=true
      or not upt_private.user_has_shift_overlap(
        auth.uid(),s.scheduled_start,s.scheduled_end,s.id,null
      )
    )
    and not exists(
      select 1
      from upt_private.shift_change_requests r
      where r.shift_id=s.id
        and r.requester_id=auth.uid()
        and r.status='pending'
    )
  order by s.scheduled_start
  limit 100;
$$;

revoke all on function public.upt_claimable_shifts() from public,anon;
grant execute on function public.upt_claimable_shifts() to authenticated;

create or replace function public.upt_request_shift_change(
  p_type text,
  p_shift uuid,
  p_replacement uuid default null,
  p_target_shift uuid default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_source public.shifts%rowtype;
  v_target public.shifts%rowtype;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_replacement uuid;
  v_replacement_response text;
  v_request uuid;
begin
  if v_actor is null then raise exception 'Aanmelden vereist.'; end if;
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if p_type not in ('swap','replacement','claim-open-shift') then
    raise exception 'Ongeldig type shiftwijziging.';
  end if;
  if v_reason is null or length(v_reason) not between 3 and 500 then
    raise exception 'Geef een reden van 3 tot 500 tekens.';
  end if;

  select * into v_source
  from public.shifts
  where id=p_shift
  for update;

  if not found then raise exception 'Dienst niet gevonden.'; end if;
  if v_source.status='cancelled' then raise exception 'Geannuleerde dienst kan niet worden gewijzigd.'; end if;
  if now()>=v_source.scheduled_start then raise exception 'Een gestarte dienst kan niet via deze workflow worden gewijzigd.'; end if;
  if exists(select 1 from public.work_sessions ws where ws.shift_id=v_source.id) then
    raise exception 'Dienst met geregistreerde werktijd kan niet worden gewijzigd.';
  end if;

  perform 1 from public.workplaces w where w.id=v_source.workplace_id for update;
  if not found then raise exception 'Werkplek niet gevonden.'; end if;

  if p_type in ('replacement','swap') then
    if v_source.user_id<>v_actor then
      raise exception 'Je kunt alleen een wijziging aanvragen voor je eigen dienst.';
    end if;
    if v_source.response_status='declined' then
      raise exception 'Gebruik een open-shift claim voor een geweigerde dienst.';
    end if;
    if p_replacement is null or p_replacement=v_actor then
      raise exception 'Kies een andere medewerker.';
    end if;
    if not upt_private.user_available_for_shift(p_replacement,v_source.event_id,v_source.shift_kind) then
      raise exception 'De gekozen medewerker is niet beschikbaar voor deze dienst.';
    end if;
    v_replacement:=p_replacement;
    v_replacement_response:='pending';
  else
    if v_source.user_id=v_actor then raise exception 'Je kunt je eigen geweigerde dienst niet claimen.'; end if;
    if v_source.response_status<>'declined' then raise exception 'Deze dienst is niet open voor een claim.'; end if;
    if not upt_private.user_available_for_shift(v_actor,v_source.event_id,v_source.shift_kind) then
      raise exception 'Je hebt geen geldige beschikbaarheid voor deze dienst.';
    end if;
    v_replacement:=v_actor;
    v_replacement_response:='accepted';
  end if;

  if p_type='swap' then
    if p_target_shift is null then raise exception 'Selecteer de dienst waarmee je wilt ruilen.'; end if;

    select * into v_target
    from public.shifts
    where id=p_target_shift
    for update;

    if not found then raise exception 'Ruildienst niet gevonden.'; end if;
    if v_target.id=v_source.id
      or v_target.event_id<>v_source.event_id
      or v_target.user_id<>v_replacement
      or v_target.status='cancelled'
      or v_target.response_status='declined'
      or now()>=v_target.scheduled_start
    then raise exception 'Deze ruildienst is niet meer geldig.'; end if;
    if exists(select 1 from public.work_sessions ws where ws.shift_id=v_target.id) then
      raise exception 'Ruildienst heeft al geregistreerde werktijd.';
    end if;
    if not upt_private.user_available_for_shift(v_actor,v_target.event_id,v_target.shift_kind) then
      raise exception 'Je bent niet beschikbaar voor de gekozen ruildienst.';
    end if;

    perform 1
    from public.workplaces w
    where w.id in (v_source.workplace_id,v_target.workplace_id)
    order by w.id
    for update;

    if not v_source.overlap_allowed
      and upt_private.user_has_shift_overlap(
        v_replacement,v_source.scheduled_start,v_source.scheduled_end,v_source.id,v_target.id
      )
    then raise exception 'De andere medewerker heeft een overlappende dienst.'; end if;

    if not v_target.overlap_allowed
      and upt_private.user_has_shift_overlap(
        v_actor,v_target.scheduled_start,v_target.scheduled_end,v_source.id,v_target.id
      )
    then raise exception 'De ruildienst overlapt met je andere planning.'; end if;
  else
    if p_target_shift is not null then raise exception 'Onverwachte ruildienst.'; end if;
    if not v_source.overlap_allowed
      and upt_private.user_has_shift_overlap(
        v_replacement,v_source.scheduled_start,v_source.scheduled_end,v_source.id,null
      )
    then raise exception 'De gekozen medewerker heeft een overlappende dienst.'; end if;
    if upt_private.shift_capacity_would_exceed(
      v_source.workplace_id,v_replacement,v_source.scheduled_start,v_source.scheduled_end,v_source.id
    ) then raise exception 'Maximumbezetting van deze werkplek wordt overschreden.'; end if;
  end if;

  begin
    insert into upt_private.shift_change_requests(
      type,shift_id,target_shift_id,event_id,workplace_id,requester_id,
      replacement_user_id,replacement_response,reason,
      source_revision_at,target_revision_at
    )
    values(
      p_type,
      v_source.id,
      case when p_type='swap' then v_target.id else null end,
      v_source.event_id,
      v_source.workplace_id,
      v_actor,
      v_replacement,
      v_replacement_response,
      v_reason,
      v_source.updated_at,
      case when p_type='swap' then v_target.updated_at else null end
    )
    returning id into v_request;
  exception when unique_violation then
    raise exception 'Er staat al een open wijzigingsaanvraag voor deze dienst.';
  end;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_actor,
    'shift.change.requested',
    'shift_change_request',
    v_request,
    jsonb_build_object(
      'type',p_type,
      'shift_id',v_source.id,
      'target_shift_id',case when p_type='swap' then v_target.id else null end,
      'replacement_user_id',v_replacement,
      'reason',v_reason
    )
  );

  if p_type in ('replacement','swap') then
    insert into public.crew_notifications(user_id,title,body,link,kind)
    values(
      v_replacement,
      case when p_type='swap' then 'Ruilverzoek voor dienst' else 'Verzoek om dienst over te nemen' end,
      case when p_type='swap'
        then 'Een collega wil een dienst met jou ruilen. Bekijk en bevestig het verzoek.'
        else 'Een collega vraagt of jij een dienst kunt overnemen. Bekijk en bevestig het verzoek.'
      end,
      '/shifts',
      'shift_change'
    );
  else
    insert into public.crew_notifications(user_id,title,body,link,kind)
    select
      p.id,
      'Open dienst geclaimd',
      'Een medewerker wil een geweigerde dienst overnemen. Beoordeel de aanvraag.',
      '/shifts',
      'shift_change'
    from public.profiles p
    where p.approved=true and p.role='admin';
  end if;

  return v_request;
end;
$function$;

revoke all on function public.upt_request_shift_change(text,uuid,uuid,uuid,text)
from public,anon;
grant execute on function public.upt_request_shift_change(text,uuid,uuid,uuid,text)
to authenticated;

create or replace function public.upt_respond_shift_change(
  p_request uuid,
  p_response text
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_request upt_private.shift_change_requests%rowtype;
  v_source public.shifts%rowtype;
  v_target public.shifts%rowtype;
begin
  if v_actor is null then raise exception 'Aanmelden vereist.'; end if;
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if p_response not in ('accepted','declined') then raise exception 'Ongeldige reactie.'; end if;

  select * into v_request
  from upt_private.shift_change_requests
  where id=p_request
  for update;

  if not found then raise exception 'Wijzigingsaanvraag niet gevonden.'; end if;
  if v_request.status<>'pending' then raise exception 'Deze aanvraag is niet meer actief.'; end if;
  if v_request.type not in ('replacement','swap') then raise exception 'Deze aanvraag vereist geen collega-reactie.'; end if;
  if v_request.replacement_user_id is distinct from v_actor then raise exception 'Deze aanvraag is niet aan jou gericht.'; end if;

  select * into v_source from public.shifts where id=v_request.shift_id;
  if v_source.updated_at>v_request.source_revision_at then
    update upt_private.shift_change_requests
    set status='rejected',
        decision_reason='Planning gewijzigd; aanvraag vervallen.',
        decided_at=now(),
        updated_at=now()
    where id=p_request;

    insert into public.crew_notifications(user_id,title,body,link,kind)
    values(v_request.requester_id,'Shiftwijziging vervallen','De planning werd gewijzigd nadat je aanvraag was gemaakt.','/shifts','shift_change');
    return;
  end if;

  if v_request.type='swap' then
    select * into v_target from public.shifts where id=v_request.target_shift_id;
    if not found or v_target.updated_at>v_request.target_revision_at then
      update upt_private.shift_change_requests
      set status='rejected',
          decision_reason='Ruildienst gewijzigd; aanvraag vervallen.',
          decided_at=now(),
          updated_at=now()
      where id=p_request;

      insert into public.crew_notifications(user_id,title,body,link,kind)
      values(v_request.requester_id,'Ruilverzoek vervallen','De ruildienst werd gewijzigd nadat je aanvraag was gemaakt.','/shifts','shift_change');
      return;
    end if;
  end if;

  if p_response='declined' then
    update upt_private.shift_change_requests
    set replacement_response='declined',
        replacement_responded_at=now(),
        status='rejected',
        decision_reason='Andere medewerker heeft geweigerd.',
        decided_at=now(),
        updated_at=now()
    where id=p_request;

    insert into public.crew_notifications(user_id,title,body,link,kind)
    values(v_request.requester_id,'Shiftwijziging geweigerd','De gekozen collega heeft het verzoek geweigerd.','/shifts','shift_change');
  else
    update upt_private.shift_change_requests
    set replacement_response='accepted',
        replacement_responded_at=now(),
        updated_at=now()
    where id=p_request;

    insert into public.crew_notifications(user_id,title,body,link,kind)
    select p.id,'Shiftwijziging klaar voor beoordeling',
      'Beide medewerkers hebben ingestemd. Beoordeel de aanvraag.',
      '/shifts','shift_change'
    from public.profiles p
    where p.approved=true and p.role='admin';

    insert into public.crew_notifications(user_id,title,body,link,kind)
    values(v_request.requester_id,'Collega heeft bevestigd','Je shiftwijziging is klaar voor beoordeling door admin.','/shifts','shift_change');
  end if;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_actor,
    case when p_response='accepted' then 'shift.change.replacement.accepted' else 'shift.change.replacement.declined' end,
    'shift_change_request',
    p_request,
    jsonb_build_object('response',p_response)
  );
end;
$function$;

revoke all on function public.upt_respond_shift_change(uuid,text) from public,anon;
grant execute on function public.upt_respond_shift_change(uuid,text) to authenticated;

create or replace function public.upt_cancel_shift_change(p_request uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_request upt_private.shift_change_requests%rowtype;
begin
  if v_actor is null then raise exception 'Aanmelden vereist.'; end if;
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;

  select * into v_request
  from upt_private.shift_change_requests
  where id=p_request
  for update;

  if not found then raise exception 'Wijzigingsaanvraag niet gevonden.'; end if;
  if v_request.requester_id<>v_actor then raise exception 'Je kunt alleen je eigen aanvraag annuleren.'; end if;
  if v_request.status<>'pending' then raise exception 'Deze aanvraag is niet meer actief.'; end if;

  update upt_private.shift_change_requests
  set status='cancelled',updated_at=now(),decided_at=now(),decision_reason='Geannuleerd door aanvrager.'
  where id=p_request;

  if v_request.replacement_user_id is not null and v_request.replacement_user_id<>v_actor then
    insert into public.crew_notifications(user_id,title,body,link,kind)
    values(v_request.replacement_user_id,'Shiftverzoek geannuleerd','De wijzigingsaanvraag werd door de aanvrager geannuleerd.','/shifts','shift_change');
  end if;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'shift.change.cancelled','shift_change_request',p_request,'{}'::jsonb);
end;
$function$;

revoke all on function public.upt_cancel_shift_change(uuid) from public,anon;
grant execute on function public.upt_cancel_shift_change(uuid) to authenticated;

create or replace function public.upt_decide_shift_change(
  p_request uuid,
  p_decision text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_request upt_private.shift_change_requests%rowtype;
  v_source public.shifts%rowtype;
  v_target public.shifts%rowtype;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_old_source_user uuid;
  v_old_target_user uuid;
begin
  if v_actor is null then raise exception 'Aanmelden vereist.'; end if;
  if not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan shiftwijzigingen beslissen.';
  end if;
  if p_decision not in ('approved','rejected') then raise exception 'Ongeldige beslissing.'; end if;
  if p_decision='rejected' and (v_reason is null or length(v_reason) not between 3 and 500) then
    raise exception 'Geef een reden van 3 tot 500 tekens.';
  end if;

  select * into v_request
  from upt_private.shift_change_requests
  where id=p_request
  for update;

  if not found then raise exception 'Wijzigingsaanvraag niet gevonden.'; end if;
  if v_request.status<>'pending' then raise exception 'Deze aanvraag is niet meer actief.'; end if;

  if p_decision='rejected' then
    update upt_private.shift_change_requests
    set status='rejected',
        decision_reason=v_reason,
        decided_by=v_actor,
        decided_at=now(),
        updated_at=now()
    where id=p_request;

    insert into public.crew_notifications(user_id,title,body,link,kind)
    select distinct x.user_id,'Shiftwijziging afgewezen',coalesce(v_reason,'De aanvraag werd afgewezen.'),'/shifts','shift_change'
    from (
      select v_request.requester_id as user_id
      union
      select v_request.replacement_user_id where v_request.replacement_user_id is not null
    ) x;

    insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_actor,'shift.change.rejected','shift_change_request',p_request,jsonb_build_object('reason',v_reason));
    return;
  end if;

  if v_request.replacement_response<>'accepted' then
    raise exception 'De andere medewerker heeft nog niet ingestemd.';
  end if;

  select * into v_source
  from public.shifts
  where id=v_request.shift_id
  for update;

  if not found
    or v_source.status='cancelled'
    or now()>=v_source.scheduled_start
    or v_source.updated_at>v_request.source_revision_at
  then
    update upt_private.shift_change_requests
    set status='rejected',
        decision_reason='Planning gewijzigd; aanvraag vervallen.',
        decided_by=v_actor,
        decided_at=now(),
        updated_at=now()
    where id=p_request;
    return;
  end if;

  if exists(select 1 from public.work_sessions ws where ws.shift_id=v_source.id) then
    raise exception 'Dienst heeft al geregistreerde werktijd.';
  end if;

  if v_request.type='swap' then
    select * into v_target
    from public.shifts
    where id=v_request.target_shift_id
    for update;

    if not found
      or v_target.status='cancelled'
      or v_target.response_status='declined'
      or now()>=v_target.scheduled_start
      or v_target.updated_at>v_request.target_revision_at
      or v_target.user_id is distinct from v_request.replacement_user_id
      or v_target.event_id<>v_source.event_id
    then
      update upt_private.shift_change_requests
      set status='rejected',
          decision_reason='Ruildienst gewijzigd; aanvraag vervallen.',
          decided_by=v_actor,
          decided_at=now(),
          updated_at=now()
      where id=p_request;
      return;
    end if;

    if exists(select 1 from public.work_sessions ws where ws.shift_id=v_target.id) then
      raise exception 'Ruildienst heeft al geregistreerde werktijd.';
    end if;

    perform 1
    from public.workplaces w
    where w.id in (v_source.workplace_id,v_target.workplace_id)
    order by w.id
    for update;

    if not upt_private.user_available_for_shift(v_request.replacement_user_id,v_source.event_id,v_source.shift_kind)
      or not upt_private.user_available_for_shift(v_request.requester_id,v_target.event_id,v_target.shift_kind)
    then raise exception 'Beschikbaarheid is intussen gewijzigd.'; end if;

    if not v_source.overlap_allowed
      and upt_private.user_has_shift_overlap(
        v_request.replacement_user_id,v_source.scheduled_start,v_source.scheduled_end,v_source.id,v_target.id
      )
    then raise exception 'De andere medewerker heeft intussen een overlappende dienst.'; end if;

    if not v_target.overlap_allowed
      and upt_private.user_has_shift_overlap(
        v_request.requester_id,v_target.scheduled_start,v_target.scheduled_end,v_source.id,v_target.id
      )
    then raise exception 'De ruildienst overlapt intussen met de planning van de aanvrager.'; end if;

    if upt_private.shift_capacity_would_exceed(
      v_source.workplace_id,v_request.replacement_user_id,v_source.scheduled_start,v_source.scheduled_end,v_source.id
    ) or upt_private.shift_capacity_would_exceed(
      v_target.workplace_id,v_request.requester_id,v_target.scheduled_start,v_target.scheduled_end,v_target.id
    ) then raise exception 'Maximumbezetting wordt door de ruil overschreden.'; end if;

    v_old_source_user:=v_source.user_id;
    v_old_target_user:=v_target.user_id;

    update public.shifts
    set user_id=v_old_target_user,
        response_status='pending',
        response_reason=null,
        responded_at=null,
        confirmed_at=null,
        confirmation_revision=now(),
        updated_at=now()
    where id=v_source.id;

    update public.shifts
    set user_id=v_old_source_user,
        response_status='pending',
        response_reason=null,
        responded_at=null,
        confirmed_at=null,
        confirmation_revision=now(),
        updated_at=now()
    where id=v_target.id;
  else
    if v_request.replacement_user_id is null then raise exception 'Nieuwe medewerker ontbreekt.'; end if;
    if v_request.type='claim-open-shift' and v_source.response_status<>'declined' then
      raise exception 'Deze dienst is niet meer open.';
    end if;

    perform 1
    from public.workplaces w
    where w.id=v_source.workplace_id
    for update;

    if not upt_private.user_available_for_shift(
      v_request.replacement_user_id,v_source.event_id,v_source.shift_kind
    ) then raise exception 'Beschikbaarheid is intussen gewijzigd.'; end if;

    if not v_source.overlap_allowed
      and upt_private.user_has_shift_overlap(
        v_request.replacement_user_id,v_source.scheduled_start,v_source.scheduled_end,v_source.id,null
      )
    then raise exception 'Nieuwe medewerker heeft intussen een overlappende dienst.'; end if;

    if upt_private.shift_capacity_would_exceed(
      v_source.workplace_id,v_request.replacement_user_id,v_source.scheduled_start,v_source.scheduled_end,v_source.id
    ) then raise exception 'Maximumbezetting van deze werkplek wordt overschreden.'; end if;

    v_old_source_user:=v_source.user_id;

    update public.shifts
    set user_id=v_request.replacement_user_id,
        response_status='pending',
        response_reason=null,
        responded_at=null,
        confirmed_at=null,
        confirmation_revision=now(),
        updated_at=now()
    where id=v_source.id;
  end if;

  update upt_private.shift_change_requests
  set status='approved',
      decision_reason=nullif(v_reason,''),
      decided_by=v_actor,
      decided_at=now(),
      updated_at=now()
  where id=p_request;

  update upt_private.shift_change_requests r
  set status='rejected',
      decision_reason='Dienst is intussen via een andere aanvraag herpland.',
      decided_by=v_actor,
      decided_at=now(),
      updated_at=now()
  where r.id<>p_request
    and r.status='pending'
    and (
      r.shift_id=v_source.id
      or r.target_shift_id=v_source.id
      or (v_request.type='swap' and (r.shift_id=v_target.id or r.target_shift_id=v_target.id))
    );

  insert into public.crew_notifications(user_id,title,body,link,kind)
  select distinct x.user_id,
    'Shiftwijziging goedgekeurd',
    'De shiftwijziging is goedgekeurd. Controleer en bevestig je actuele dienst.',
    '/shifts',
    'shift_change'
  from (
    select v_request.requester_id as user_id
    union
    select v_request.replacement_user_id where v_request.replacement_user_id is not null
    union
    select v_old_source_user where v_request.type='claim-open-shift'
  ) x;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_actor,
    'shift.change.approved',
    'shift_change_request',
    p_request,
    jsonb_build_object(
      'type',v_request.type,
      'shift_id',v_source.id,
      'target_shift_id',v_request.target_shift_id,
      'requester_id',v_request.requester_id,
      'replacement_user_id',v_request.replacement_user_id
    )
  );
end;
$function$;

revoke all on function public.upt_decide_shift_change(uuid,text,text)
from public,anon;
grant execute on function public.upt_decide_shift_change(uuid,text,text)
to authenticated;

create or replace function public.upt_shift_change_requests()
returns table(
  id uuid,
  type text,
  shift_id uuid,
  target_shift_id uuid,
  event_id uuid,
  workplace_id uuid,
  requester_id uuid,
  requester_name text,
  replacement_user_id uuid,
  replacement_name text,
  status text,
  replacement_response text,
  reason text,
  decision_reason text,
  source_scheduled_start timestamptz,
  source_scheduled_end timestamptz,
  source_role_name text,
  source_workplace_name text,
  target_scheduled_start timestamptz,
  target_scheduled_end timestamptz,
  target_role_name text,
  target_workplace_name text,
  is_stale boolean,
  created_at timestamptz,
  updated_at timestamptz,
  replacement_responded_at timestamptz,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select
    r.id,
    r.type,
    r.shift_id,
    r.target_shift_id,
    r.event_id,
    r.workplace_id,
    r.requester_id,
    requester.full_name,
    r.replacement_user_id,
    replacement.full_name,
    r.status,
    r.replacement_response,
    r.reason,
    r.decision_reason,
    source.scheduled_start,
    source.scheduled_end,
    source.role_name,
    source_workplace.name,
    target.scheduled_start,
    target.scheduled_end,
    target.role_name,
    target_workplace.name,
    (
      source.updated_at>r.source_revision_at
      or (r.target_shift_id is not null and (target.id is null or target.updated_at>r.target_revision_at))
    ) as is_stale,
    r.created_at,
    r.updated_at,
    r.replacement_responded_at,
    r.decided_at
  from upt_private.shift_change_requests r
  join public.shifts source on source.id=r.shift_id
  join public.workplaces source_workplace on source_workplace.id=source.workplace_id
  join public.profiles requester on requester.id=r.requester_id
  left join public.profiles replacement on replacement.id=r.replacement_user_id
  left join public.shifts target on target.id=r.target_shift_id
  left join public.workplaces target_workplace on target_workplace.id=target.workplace_id
  where public.upt_is_approved()
    and (
      public.upt_is_admin(auth.uid())
      or r.requester_id=auth.uid()
      or r.replacement_user_id=auth.uid()
    )
    and (r.status='pending' or r.updated_at>=now()-interval '30 days')
  order by
    case r.status when 'pending' then 0 else 1 end,
    r.updated_at desc;
$$;

revoke all on function public.upt_shift_change_requests() from public,anon;
grant execute on function public.upt_shift_change_requests() to authenticated;

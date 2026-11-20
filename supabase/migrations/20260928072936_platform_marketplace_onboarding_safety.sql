alter table public.shifts
  add column if not exists marketplace_open boolean not null default false,
  add column if not exists marketplace_note text,
  add column if not exists marketplace_opened_at timestamptz,
  add column if not exists marketplace_opened_by uuid references public.profiles(id) on delete set null;

create index if not exists shifts_marketplace_open_idx
on public.shifts(event_id,scheduled_start)
where marketplace_open=true and status<>'cancelled';

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conname='shifts_marketplace_note_check'
      and conrelid='public.shifts'::regclass
  ) then
    alter table public.shifts add constraint shifts_marketplace_note_check
      check(marketplace_note is null or length(marketplace_note)<=1000);
  end if;
end $$;

create table if not exists upt_private.shift_marketplace_claims(
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  claimant_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check(length(trim(reason)) between 3 and 500),
  status text not null default 'pending' check(status in('pending','approved','rejected','cancelled')),
  decided_by uuid references public.profiles(id) on delete set null,
  decision_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create unique index if not exists shift_marketplace_claims_pending_unique_idx
on upt_private.shift_marketplace_claims(shift_id,claimant_id)
where status='pending';

create index if not exists shift_marketplace_claims_shift_status_idx
on upt_private.shift_marketplace_claims(shift_id,status,created_at);

create index if not exists shift_marketplace_claims_claimant_idx
on upt_private.shift_marketplace_claims(claimant_id,status,created_at desc);

alter table upt_private.shift_marketplace_claims enable row level security;
revoke all on table upt_private.shift_marketplace_claims from public,anon,authenticated;

create or replace function public.upt_set_shift_marketplace(p_shift uuid,p_open boolean,p_note text default null)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_shift public.shifts%rowtype;
  v_note text:=nullif(trim(coalesce(p_note,'')),'');
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan de shiftmarktplaats beheren.';
  end if;
  if length(coalesce(v_note,''))>1000 then raise exception 'Marktplaatsnotitie is te lang.'; end if;

  select * into v_shift from public.shifts where id=p_shift for update;
  if not found then raise exception 'Dienst niet gevonden.'; end if;
  if v_shift.status='cancelled' or now()>=v_shift.scheduled_start then
    raise exception 'Alleen toekomstige actieve diensten kunnen worden opengesteld.';
  end if;

  update public.shifts
  set marketplace_open=p_open,
      marketplace_note=case when p_open then v_note else null end,
      marketplace_opened_at=case when p_open then now() else null end,
      marketplace_opened_by=case when p_open then v_actor else null end,
      updated_at=now()
  where id=p_shift;

  if not p_open then
    update upt_private.shift_marketplace_claims
    set status='cancelled',decided_by=v_actor,decision_reason='Marktplaats gesloten.',decided_at=now()
    where shift_id=p_shift and status='pending';
  end if;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,case when p_open then 'shift.marketplace.opened' else 'shift.marketplace.closed' end,'shift',p_shift,jsonb_build_object('note',v_note));
end;
$fn$;

revoke all on function public.upt_set_shift_marketplace(uuid,boolean,text) from public,anon;
grant execute on function public.upt_set_shift_marketplace(uuid,boolean,text) to authenticated;

create or replace function public.upt_marketplace_shifts()
returns table(
  shift_id uuid,event_id uuid,event_name text,workplace_id uuid,workplace_name text,
  role_name text,shift_kind text,scheduled_start timestamptz,scheduled_end timestamptz,
  marketplace_note text,claim_pending boolean
)
language sql
stable
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
  select
    s.id,s.event_id,e.name,s.workplace_id,w.name,s.role_name,s.shift_kind,
    s.scheduled_start,s.scheduled_end,s.marketplace_note,
    exists(
      select 1 from upt_private.shift_marketplace_claims c
      where c.shift_id=s.id and c.claimant_id=(select auth.uid()) and c.status='pending'
    )
  from public.shifts s
  join public.events e on e.id=s.event_id
  join public.workplaces w on w.id=s.workplace_id
  where public.upt_is_approved()
    and s.marketplace_open=true
    and s.status<>'cancelled'
    and s.scheduled_start>now()
    and s.user_id<>(select auth.uid())
    and coalesce(e.status,'')<>'archived'
    and exists(
      select 1
      from public.event_availability ea
      where ea.event_id=s.event_id
        and ea.user_id=(select auth.uid())
        and (
          (s.shift_kind='event' and ea.response='can')
          or (s.shift_kind='setup' and ea.setup_available=true)
          or (s.shift_kind='breakdown' and ea.breakdown_available=true)
        )
        and (ea.available_from is null or ea.available_from<=s.scheduled_start)
        and (ea.available_until is null or ea.available_until>=s.scheduled_end)
    )
    and (
      s.overlap_allowed=true
      or not exists(
        select 1 from public.shifts own
        where own.user_id=(select auth.uid())
          and own.id<>s.id
          and own.status<>'cancelled'
          and own.response_status<>'declined'
          and own.scheduled_start<s.scheduled_end
          and own.scheduled_end>s.scheduled_start
      )
    )
  order by s.scheduled_start,w.name
  limit 100;
$fn$;

revoke all on function public.upt_marketplace_shifts() from public,anon;
grant execute on function public.upt_marketplace_shifts() to authenticated;

create or replace function public.upt_claim_marketplace_shift(p_shift uuid,p_reason text)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_shift public.shifts%rowtype;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_claim uuid;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if v_reason is null or length(v_reason) not between 3 and 500 then raise exception 'Geef een reden van 3 tot 500 tekens.'; end if;

  select * into v_shift from public.shifts where id=p_shift for update;
  if not found or not v_shift.marketplace_open or v_shift.status='cancelled' or now()>=v_shift.scheduled_start then
    raise exception 'Deze dienst staat niet meer open op de marktplaats.';
  end if;
  if v_shift.user_id=v_actor then raise exception 'Je kunt je eigen dienst niet claimen.'; end if;
  if not upt_private.user_available_for_shift(v_actor,v_shift.event_id,v_shift.shift_kind) then
    raise exception 'Je hebt geen geldige beschikbaarheid voor deze dienst.';
  end if;
  if not v_shift.overlap_allowed and upt_private.user_has_shift_overlap(v_actor,v_shift.scheduled_start,v_shift.scheduled_end,v_shift.id,null) then
    raise exception 'Deze dienst overlapt met je bestaande planning.';
  end if;
  if upt_private.shift_capacity_would_exceed(v_shift.workplace_id,v_actor,v_shift.scheduled_start,v_shift.scheduled_end,v_shift.id) then
    raise exception 'Maximumbezetting van deze werkplek wordt overschreden.';
  end if;
  if exists(
    select 1 from upt_private.shift_marketplace_claims c
    where c.shift_id=p_shift and c.claimant_id=v_actor and c.status='pending'
  ) then raise exception 'Je hebt deze dienst al geclaimd.'; end if;

  insert into upt_private.shift_marketplace_claims(shift_id,event_id,workplace_id,claimant_id,reason)
  values(p_shift,v_shift.event_id,v_shift.workplace_id,v_actor,v_reason)
  returning id into v_claim;

  insert into public.crew_notifications(user_id,title,body,link,kind)
  select p.id,'Open dienst geclaimd','Een medewerker heeft een open dienst geclaimd. Beoordeel de aanvraag.','/shifts','shift_marketplace'
  from public.profiles p
  where p.approved=true and p.role='admin';

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'shift.marketplace.claimed','shift_marketplace_claim',v_claim,jsonb_build_object('shift_id',p_shift,'reason',v_reason));

  return v_claim;
end;
$fn$;

revoke all on function public.upt_claim_marketplace_shift(uuid,text) from public,anon;
grant execute on function public.upt_claim_marketplace_shift(uuid,text) to authenticated;

create or replace function public.upt_marketplace_claims()
returns table(
  claim_id uuid,shift_id uuid,event_name text,workplace_name text,claimant_id uuid,
  claimant_name text,current_assignee_id uuid,current_assignee_name text,reason text,status text,
  scheduled_start timestamptz,scheduled_end timestamptz,created_at timestamptz
)
language sql
stable
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
  select
    c.id,c.shift_id,e.name,w.name,c.claimant_id,claimant.full_name,
    s.user_id,assignee.full_name,c.reason,c.status,s.scheduled_start,s.scheduled_end,c.created_at
  from upt_private.shift_marketplace_claims c
  join public.shifts s on s.id=c.shift_id
  join public.events e on e.id=c.event_id
  join public.workplaces w on w.id=c.workplace_id
  join public.profiles claimant on claimant.id=c.claimant_id
  join public.profiles assignee on assignee.id=s.user_id
  where public.upt_is_approved()
    and (
      public.upt_is_admin((select auth.uid()))
      or c.claimant_id=(select auth.uid())
      or s.user_id=(select auth.uid())
    )
  order by case c.status when 'pending' then 0 else 1 end,c.created_at desc
  limit 200;
$fn$;

revoke all on function public.upt_marketplace_claims() from public,anon;
grant execute on function public.upt_marketplace_claims() to authenticated;

create or replace function public.upt_decide_marketplace_claim(p_claim uuid,p_decision text,p_reason text default null)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_claim upt_private.shift_marketplace_claims%rowtype;
  v_shift public.shifts%rowtype;
  v_claimant_role text;
  v_old_user uuid;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan marktplaatsclaims beslissen.';
  end if;
  if p_decision not in('approved','rejected') then raise exception 'Ongeldige beslissing.'; end if;
  if p_decision='rejected' and (v_reason is null or length(v_reason) not between 3 and 500) then
    raise exception 'Geef een reden van 3 tot 500 tekens.';
  end if;

  select * into v_claim from upt_private.shift_marketplace_claims where id=p_claim for update;
  if not found or v_claim.status<>'pending' then raise exception 'Deze claim is niet meer actief.'; end if;

  select * into v_shift from public.shifts where id=v_claim.shift_id for update;
  if not found or not v_shift.marketplace_open or v_shift.status='cancelled' or now()>=v_shift.scheduled_start then
    raise exception 'Deze dienst staat niet meer open.';
  end if;

  if p_decision='rejected' then
    update upt_private.shift_marketplace_claims
    set status='rejected',decided_by=v_actor,decision_reason=v_reason,decided_at=now()
    where id=p_claim;
    insert into public.crew_notifications(user_id,title,body,link,kind)
    values(v_claim.claimant_id,'Dienstclaim afgewezen',v_reason,'/shifts','shift_marketplace');
    return;
  end if;

  if not upt_private.user_available_for_shift(v_claim.claimant_id,v_shift.event_id,v_shift.shift_kind) then
    raise exception 'Beschikbaarheid is intussen gewijzigd.';
  end if;
  if not v_shift.overlap_allowed and upt_private.user_has_shift_overlap(v_claim.claimant_id,v_shift.scheduled_start,v_shift.scheduled_end,v_shift.id,null) then
    raise exception 'Nieuwe medewerker heeft intussen een overlappende dienst.';
  end if;

  select role into v_claimant_role from public.profiles where id=v_claim.claimant_id and approved=true;
  if v_claimant_role is null then raise exception 'Medewerker is niet meer goedgekeurd.'; end if;

  insert into public.event_members(event_id,user_id,event_role)
  values(
    v_shift.event_id,v_claim.claimant_id,
    case when v_claimant_role='responsible_lead' then 'responsible_lead'
         when v_claimant_role='admin' then 'admin'
         else 'employee' end
  )
  on conflict(event_id,user_id) do nothing;

  v_old_user:=v_shift.user_id;
  update public.shifts
  set user_id=v_claim.claimant_id,
      response_status='pending',response_reason=null,responded_at=null,confirmed_at=null,
      confirmation_revision=now(),marketplace_open=false,marketplace_note=null,
      marketplace_opened_at=null,marketplace_opened_by=null,updated_at=now()
  where id=v_shift.id;

  update upt_private.shift_marketplace_claims
  set status=case when id=p_claim then 'approved' else 'rejected' end,
      decided_by=v_actor,
      decision_reason=case when id=p_claim then v_reason else 'Dienst werd via een andere claim toegewezen.' end,
      decided_at=now()
  where shift_id=v_shift.id and status='pending';

  insert into public.crew_notifications(user_id,title,body,link,kind)
  select x.user_id,'Open dienst toegewezen','De open dienst werd toegewezen. Controleer de actuele planning en bevestig indien nodig.','/shifts','shift_marketplace'
  from(select v_claim.claimant_id as user_id union select v_old_user)x;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'shift.marketplace.claim.approved','shift_marketplace_claim',p_claim,jsonb_build_object(
    'shift_id',v_shift.id,'old_user_id',v_old_user,'new_user_id',v_claim.claimant_id
  ));
end;
$fn$;

revoke all on function public.upt_decide_marketplace_claim(uuid,text,text) from public,anon;
grant execute on function public.upt_decide_marketplace_claim(uuid,text,text) to authenticated;

create or replace function upt_private.require_event_onboarding_before_checkin()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
begin
  if exists(select 1 from public.events e where e.id=new.event_id and e.onboarding_required=true)
    and not exists(
      select 1 from public.event_onboarding_progress p
      where p.event_id=new.event_id and p.user_id=new.user_id and p.step='confirmed'
    )
  then raise exception 'Rond eerst de evenement-onboarding af.'; end if;
  return new;
end;
$fn$;
revoke all on function upt_private.require_event_onboarding_before_checkin() from public,anon,authenticated;

drop trigger if exists require_event_onboarding_before_checkin on public.check_ins;
create trigger require_event_onboarding_before_checkin
before insert on public.check_ins
for each row execute function upt_private.require_event_onboarding_before_checkin();

create or replace function upt_private.enrich_incident_from_offline()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_incident uuid;
  v_category text;
  v_urgency text;
begin
  if new.operation_type<>'incident' then return new; end if;
  v_incident:=nullif(new.result->>'id','')::uuid;
  if v_incident is null then return new; end if;

  v_category:=coalesce(nullif(new.payload->>'category',''),'general');
  v_urgency:=coalesce(nullif(new.payload->>'urgency',''),'urgent');
  if v_category not in('medical','safety','security','equipment','technical','staff','general') then v_category:='general'; end if;
  if v_urgency not in('normal','high','urgent') then v_urgency:='urgent'; end if;

  update public.incidents
  set category=v_category,
      urgency=v_urgency,
      people_involved=nullif(trim(coalesce(new.payload->>'people_involved','')),''),
      action_taken=nullif(trim(coalesce(new.payload->>'action_taken','')),'')
  where id=v_incident and reporter_id=new.user_id;
  return new;
end;
$fn$;
revoke all on function upt_private.enrich_incident_from_offline() from public,anon,authenticated;

drop trigger if exists enrich_incident_from_offline on public.offline_operation_records;
create trigger enrich_incident_from_offline
after insert on public.offline_operation_records
for each row when(new.operation_type='incident')
execute function upt_private.enrich_incident_from_offline();

notify pgrst,'reload schema';


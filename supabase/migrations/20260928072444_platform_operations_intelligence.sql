
-- UpTillDawn platform operations intelligence.
-- Additive platform layer for planning, templates, assets, control center,
-- reporting/cost estimates, availability, onboarding, QR resources,
-- incident classification, knowledge, feature rollout and recovery readiness.

alter table public.event_templates
  add column if not exists source_event_id uuid references public.events(id) on delete set null,
  add column if not exists sections text[] not null default '{}'::text[],
  add column if not exists updated_at timestamptz not null default now();

-- Existing installations had an approved-user permissive policy. Add a restrictive
-- admin gate so only admins can read or mutate template rows.
drop policy if exists event_templates_admin_gate on public.event_templates;
create policy event_templates_admin_gate
on public.event_templates
as restrictive
for all
to authenticated
using (public.upt_is_admin((select auth.uid())))
with check (public.upt_is_admin((select auth.uid())));

revoke all on table public.event_templates from anon;
grant select,insert,update,delete on table public.event_templates to authenticated;

alter table public.event_availability
  add column if not exists available_from timestamptz,
  add column if not exists available_until timestamptz,
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='event_availability_window_check'
      and conrelid='public.event_availability'::regclass
  ) then
    alter table public.event_availability
      add constraint event_availability_window_check
      check (
        (available_from is null and available_until is null)
        or (available_from is not null and available_until is not null and available_until>available_from)
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='event_availability_notes_check'
      and conrelid='public.event_availability'::regclass
  ) then
    alter table public.event_availability
      add constraint event_availability_notes_check
      check (notes is null or length(notes)<=1000);
  end if;
end $$;

alter table public.workplaces
  add column if not exists map_x numeric,
  add column if not exists map_y numeric,
  add column if not exists map_label text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='workplaces_map_coordinates_check'
      and conrelid='public.workplaces'::regclass
  ) then
    alter table public.workplaces
      add constraint workplaces_map_coordinates_check
      check (
        (map_x is null and map_y is null)
        or (
          map_x between 0 and 1
          and map_y between 0 and 1
        )
      );
  end if;
end $$;

alter table public.events
  add column if not exists onboarding_required boolean not null default true;

alter table public.inventory_items
  add column if not exists asset_code text,
  add column if not exists barcode text,
  add column if not exists serial_number text,
  add column if not exists photo_path text,
  add column if not exists purchase_date date,
  add column if not exists last_maintenance_at timestamptz,
  add column if not exists maintenance_due_at timestamptz,
  add column if not exists location_label text,
  add column if not exists reorder_threshold integer not null default 0,
  add column if not exists unit_cost_cents integer,
  add column if not exists asset_notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='inventory_items_asset_metadata_check'
      and conrelid='public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_asset_metadata_check
      check (
        reorder_threshold between 0 and 100000
        and (unit_cost_cents is null or unit_cost_cents between 0 and 1000000000)
        and (asset_code is null or length(asset_code) between 1 and 120)
        and (barcode is null or length(barcode) between 1 and 200)
        and (serial_number is null or length(serial_number) between 1 and 200)
        and (location_label is null or length(location_label)<=300)
        and (asset_notes is null or length(asset_notes)<=4000)
      );
  end if;
end $$;

create unique index if not exists inventory_items_asset_code_unique_idx
  on public.inventory_items(asset_code)
  where asset_code is not null and is_active=true;

create index if not exists inventory_items_barcode_idx
  on public.inventory_items(barcode)
  where barcode is not null and is_active=true;

create index if not exists inventory_items_maintenance_due_idx
  on public.inventory_items(maintenance_due_at)
  where maintenance_due_at is not null and is_active=true;

alter table public.incidents
  add column if not exists category text not null default 'general',
  add column if not exists urgency text not null default 'urgent',
  add column if not exists people_involved text,
  add column if not exists action_taken text,
  add column if not exists resolution_notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='incidents_category_check'
      and conrelid='public.incidents'::regclass
  ) then
    alter table public.incidents
      add constraint incidents_category_check
      check (category in ('medical','safety','security','equipment','technical','staff','general'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='incidents_urgency_check'
      and conrelid='public.incidents'::regclass
  ) then
    alter table public.incidents
      add constraint incidents_urgency_check
      check (urgency in ('normal','high','urgent'));
  end if;
end $$;

create index if not exists incidents_event_urgency_status_idx
  on public.incidents(event_id,urgency,status,created_at desc);

create table if not exists public.planning_recommendations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  recommended_user_id uuid not null references public.profiles(id) on delete cascade,
  role_name text not null default 'Personeel',
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  score integer not null default 0,
  reasons jsonb not null default '{}'::jsonb,
  status text not null default 'proposed' check (status in ('proposed','applied','dismissed','stale')),
  applied_shift_id uuid references public.shifts(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end>scheduled_start)
);

create unique index if not exists planning_recommendations_open_unique_idx
  on public.planning_recommendations(event_id,workplace_id,recommended_user_id,scheduled_start,scheduled_end)
  where status='proposed';

create index if not exists planning_recommendations_event_status_idx
  on public.planning_recommendations(event_id,status,score desc);

alter table public.planning_recommendations enable row level security;
revoke all on table public.planning_recommendations from anon;
grant select,insert,update,delete on table public.planning_recommendations to authenticated;

drop policy if exists planning_recommendations_admin on public.planning_recommendations;
create policy planning_recommendations_admin
on public.planning_recommendations
for all
to authenticated
using (
  public.upt_is_approved()
  and public.upt_is_admin((select auth.uid()))
)
with check (
  public.upt_is_approved()
  and public.upt_is_admin((select auth.uid()))
);

create table if not exists public.staff_pay_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  hourly_rate_cents integer not null check (hourly_rate_cents between 0 and 10000000),
  employer_cost_multiplier_bps integer not null default 10000 check (employer_cost_multiplier_bps between 10000 and 50000),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  effective_from date not null default current_date,
  effective_until date,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until>=effective_from),
  check (notes is null or length(notes)<=1000)
);

create index if not exists staff_pay_rates_user_effective_idx
  on public.staff_pay_rates(user_id,effective_from desc);

alter table public.staff_pay_rates enable row level security;
revoke all on table public.staff_pay_rates from anon;
grant select,insert,update,delete on table public.staff_pay_rates to authenticated;

drop policy if exists staff_pay_rates_admin on public.staff_pay_rates;
create policy staff_pay_rates_admin
on public.staff_pay_rates
for all
to authenticated
using (
  public.upt_is_approved()
  and public.upt_is_admin((select auth.uid()))
)
with check (
  public.upt_is_approved()
  and public.upt_is_admin((select auth.uid()))
);

create table if not exists public.event_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  snapshot jsonb not null,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  generation_kind text not null default 'manual' check (generation_kind in ('manual','automatic'))
);

create index if not exists event_report_snapshots_event_idx
  on public.event_report_snapshots(event_id,generated_at desc);

alter table public.event_report_snapshots enable row level security;
revoke all on table public.event_report_snapshots from anon;
grant select on table public.event_report_snapshots to authenticated;

drop policy if exists event_report_snapshots_manager_read on public.event_report_snapshots;
create policy event_report_snapshots_manager_read
on public.event_report_snapshots
for select
to authenticated
using (
  public.upt_is_approved()
  and (
    public.upt_is_admin((select auth.uid()))
    or public.upt_is_responsible(event_id,null,(select auth.uid()))
  )
);

create table if not exists public.event_onboarding_progress (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  step text not null check (step in ('briefing','safety','map','workplace','responsible','inventory','confirmed')),
  completed_at timestamptz not null default now(),
  primary key (event_id,user_id,step)
);

create index if not exists event_onboarding_progress_user_idx
  on public.event_onboarding_progress(user_id,event_id);

alter table public.event_onboarding_progress enable row level security;
revoke all on table public.event_onboarding_progress from anon;
grant select on table public.event_onboarding_progress to authenticated;

drop policy if exists event_onboarding_progress_read on public.event_onboarding_progress;
create policy event_onboarding_progress_read
on public.event_onboarding_progress
for select
to authenticated
using (
  public.upt_is_approved()
  and (
    user_id=(select auth.uid())
    or public.upt_is_admin((select auth.uid()))
    or public.upt_is_responsible(event_id,null,(select auth.uid()))
  )
);

create table if not exists public.qr_resources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default encode(extensions.gen_random_bytes(10),'hex'),
  event_id uuid references public.events(id) on delete cascade,
  workplace_id uuid references public.workplaces(id) on delete cascade,
  resource_type text not null check (resource_type in ('workplace','inventory','document','checklist','task','knowledge')),
  resource_id uuid,
  title text not null,
  route text not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(code) between 8 and 120),
  check (length(title) between 1 and 200),
  check (route like '/%' and route not like '//%' and route not like '%://%')
);

create index if not exists qr_resources_scope_idx
  on public.qr_resources(event_id,workplace_id,active);

alter table public.qr_resources enable row level security;
revoke all on table public.qr_resources from anon;
grant select,insert,update,delete on table public.qr_resources to authenticated;

drop policy if exists qr_resources_admin on public.qr_resources;
create policy qr_resources_admin
on public.qr_resources
for all
to authenticated
using (
  public.upt_is_approved()
  and public.upt_is_admin((select auth.uid()))
)
with check (
  public.upt_is_approved()
  and public.upt_is_admin((select auth.uid()))
);

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  workplace_id uuid references public.workplaces(id) on delete cascade,
  category text,
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null check (length(trim(body)) between 1 and 20000),
  offline_critical boolean not null default false,
  is_published boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (category is null or length(category)<=120)
);

create index if not exists knowledge_articles_scope_idx
  on public.knowledge_articles(event_id,workplace_id,is_published,updated_at desc);

alter table public.knowledge_articles enable row level security;
revoke all on table public.knowledge_articles from anon;
grant select,insert,update,delete on table public.knowledge_articles to authenticated;

drop policy if exists knowledge_articles_admin on public.knowledge_articles;
create policy knowledge_articles_admin
on public.knowledge_articles
for all
to authenticated
using (
  public.upt_is_approved()
  and public.upt_is_admin((select auth.uid()))
)
with check (
  public.upt_is_approved()
  and public.upt_is_admin((select auth.uid()))
);

drop policy if exists knowledge_articles_assigned_read on public.knowledge_articles;
create policy knowledge_articles_assigned_read
on public.knowledge_articles
for select
to authenticated
using (
  public.upt_is_approved()
  and is_published=true
  and (
    event_id is null
    or public.upt_is_admin((select auth.uid()))
    or public.upt_is_responsible(event_id,workplace_id,(select auth.uid()))
    or exists (
      select 1
      from public.shifts s
      where s.user_id=(select auth.uid())
        and s.event_id=knowledge_articles.event_id
        and (knowledge_articles.workplace_id is null or s.workplace_id=knowledge_articles.workplace_id)
        and s.status<>'cancelled'
        and s.response_status<>'declined'
    )
  )
);

create table if not exists public.feature_rollouts (
  feature_key text primary key,
  enabled boolean not null default false,
  audience text not null default 'all' check (audience in ('all','admin','responsible','staff')),
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (length(feature_key) between 1 and 120),
  check (notes is null or length(notes)<=1000)
);

alter table public.feature_rollouts enable row level security;
revoke all on table public.feature_rollouts from anon;
grant select,insert,update,delete on table public.feature_rollouts to authenticated;

drop policy if exists feature_rollouts_read on public.feature_rollouts;
create policy feature_rollouts_read
on public.feature_rollouts
for select
to authenticated
using (public.upt_is_approved());

drop policy if exists feature_rollouts_admin_write on public.feature_rollouts;
create policy feature_rollouts_admin_write
on public.feature_rollouts
for all
to authenticated
using (
  public.upt_is_approved()
  and public.upt_is_admin((select auth.uid()))
)
with check (
  public.upt_is_approved()
  and public.upt_is_admin((select auth.uid()))
);

create table if not exists public.configuration_versions (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'platform',
  note text,
  snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (length(kind) between 1 and 120),
  check (note is null or length(note)<=1000)
);

create index if not exists configuration_versions_created_idx
  on public.configuration_versions(created_at desc);

alter table public.configuration_versions enable row level security;
revoke all on table public.configuration_versions from anon;
grant select on table public.configuration_versions to authenticated;

drop policy if exists configuration_versions_admin_read on public.configuration_versions;
create policy configuration_versions_admin_read
on public.configuration_versions
for select
to authenticated
using (
  public.upt_is_approved()
  and public.upt_is_admin((select auth.uid()))
);

create table if not exists public.recovery_checks (
  id uuid primary key default gen_random_uuid(),
  check_type text not null,
  status text not null check (status in ('pass','warning','fail','pending')),
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists recovery_checks_type_time_idx
  on public.recovery_checks(check_type,checked_at desc);

alter table public.recovery_checks enable row level security;
revoke all on table public.recovery_checks from anon;
grant select on table public.recovery_checks to authenticated;

drop policy if exists recovery_checks_admin_read on public.recovery_checks;
create policy recovery_checks_admin_read
on public.recovery_checks
for select
to authenticated
using (
  public.upt_is_approved()
  and public.upt_is_admin((select auth.uid()))
);

create or replace function public.upt_set_event_availability_window(
  p_event uuid,
  p_response text,
  p_setup boolean,
  p_breakdown boolean,
  p_available_from timestamptz default null,
  p_available_until timestamptz default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
  v_event public.events%rowtype;
begin
  if auth.uid() is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_response not in ('can','cannot') then raise exception 'Ongeldige beschikbaarheid.'; end if;
  if (p_available_from is null)<>(p_available_until is null) then raise exception 'Vul zowel beschikbaar vanaf als tot in.'; end if;
  if p_available_from is not null and p_available_until<=p_available_from then raise exception 'Beschikbaar tot moet na beschikbaar vanaf liggen.'; end if;
  if length(coalesce(v_notes,''))>1000 then raise exception 'Notitie is te lang.'; end if;

  select * into v_event
  from public.events e
  where e.id=p_event and e.status<>'archived' and now()<e.start_at;
  if not found then raise exception 'Beschikbaarheid kan alleen voor een toekomstig evenement worden ingesteld.'; end if;

  if p_available_from is not null and (
    p_available_from < v_event.start_at - interval '3 days'
    or p_available_until > v_event.end_at + interval '3 days'
  ) then
    raise exception 'Beschikbaarheidsvenster moet binnen opbouw, evenement en afbouw vallen.';
  end if;

  insert into public.event_availability(
    event_id,user_id,response,responded_at,updated_at,setup_available,breakdown_available,
    available_from,available_until,notes
  )
  values(
    p_event,auth.uid(),p_response,now(),now(),p_setup,p_breakdown,
    p_available_from,p_available_until,v_notes
  )
  on conflict(event_id,user_id)
  do update set
    response=excluded.response,
    responded_at=now(),
    updated_at=now(),
    setup_available=excluded.setup_available,
    breakdown_available=excluded.breakdown_available,
    available_from=excluded.available_from,
    available_until=excluded.available_until,
    notes=excluded.notes;
end;
$fn$;

revoke all on function public.upt_set_event_availability_window(uuid,text,boolean,boolean,timestamptz,timestamptz,text)
from public,anon;
grant execute on function public.upt_set_event_availability_window(uuid,text,boolean,boolean,timestamptz,timestamptz,text)
to authenticated;

create or replace function public.upt_generate_planning_recommendations(p_event uuid)
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_event public.events%rowtype;
  v_workplace record;
  v_shortage integer;
  v_inserted integer:=0;
  v_count integer;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan planningvoorstellen genereren.';
  end if;

  select * into v_event from public.events where id=p_event for update;
  if not found or v_event.status='archived' then raise exception 'Evenement niet gevonden.'; end if;
  if now()>=v_event.end_at then raise exception 'Planningvoorstellen zijn alleen beschikbaar vóór het einde van het evenement.'; end if;

  update public.planning_recommendations
  set status='stale',updated_at=now()
  where event_id=p_event and status='proposed';

  for v_workplace in
    select w.id,w.name,w.target_staff
    from public.workplaces w
    where w.event_id=p_event and w.is_active=true and w.target_staff>0
    order by w.sort_order,w.name
  loop
    select greatest(0,v_workplace.target_staff-count(distinct s.user_id))::integer
    into v_shortage
    from public.shifts s
    where s.event_id=p_event
      and s.workplace_id=v_workplace.id
      and s.status<>'cancelled'
      and s.response_status<>'declined'
      and s.scheduled_start<=v_event.start_at
      and s.scheduled_end>=v_event.end_at;

    if v_shortage<=0 then continue; end if;

    insert into public.planning_recommendations(
      event_id,workplace_id,recommended_user_id,role_name,scheduled_start,scheduled_end,
      score,reasons,status,created_by
    )
    select
      p_event,
      v_workplace.id,
      ranked.user_id,
      'Personeel',
      v_event.start_at,
      v_event.end_at,
      ranked.score,
      jsonb_build_object(
        'availability','confirmed',
        'previousWorkplaceShifts',ranked.previous_workplace_shifts,
        'targetShortage',v_shortage
      ),
      'proposed',
      v_actor
    from (
      select
        ea.user_id,
        count(history.id)::integer as previous_workplace_shifts,
        (100 + least(100,count(history.id)::integer*10))::integer as score,
        row_number() over(
          order by count(history.id) desc,coalesce(p.full_name,''),ea.user_id
        ) as rn
      from public.event_availability ea
      join public.profiles p on p.id=ea.user_id and p.approved=true
      left join public.shifts history
        on history.user_id=ea.user_id
       and history.workplace_id=v_workplace.id
       and history.event_id<>p_event
       and history.status<>'cancelled'
      where ea.event_id=p_event
        and ea.response='can'
        and (ea.available_from is null or ea.available_from<=v_event.start_at)
        and (ea.available_until is null or ea.available_until>=v_event.end_at)
        and not exists (
          select 1
          from public.shifts other
          where other.user_id=ea.user_id
            and other.status<>'cancelled'
            and other.response_status<>'declined'
            and other.scheduled_start<v_event.end_at
            and other.scheduled_end>v_event.start_at
        )
      group by ea.user_id,p.full_name
    ) ranked
    where ranked.rn<=v_shortage;

    get diagnostics v_count=row_count;
    v_inserted:=v_inserted+v_count;
  end loop;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'planning.recommendations.generated','event',p_event,jsonb_build_object('count',v_inserted));

  return v_inserted;
end;
$fn$;

revoke all on function public.upt_generate_planning_recommendations(uuid) from public,anon;
grant execute on function public.upt_generate_planning_recommendations(uuid) to authenticated;

create or replace function public.upt_apply_planning_recommendation(p_recommendation uuid)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_rec public.planning_recommendations%rowtype;
  v_role text;
  v_shift uuid;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan planningvoorstellen toepassen.';
  end if;

  select * into v_rec
  from public.planning_recommendations
  where id=p_recommendation
  for update;

  if not found or v_rec.status<>'proposed' then raise exception 'Planningvoorstel is niet meer actief.'; end if;

  select role into v_role from public.profiles
  where id=v_rec.recommended_user_id and approved=true;
  if v_role is null then raise exception 'Medewerker is niet meer beschikbaar.'; end if;

  insert into public.event_members(event_id,user_id,event_role)
  values(
    v_rec.event_id,
    v_rec.recommended_user_id,
    case when v_role='responsible_lead' then 'responsible_lead'
         when v_role='admin' then 'admin'
         else 'employee' end
  )
  on conflict(event_id,user_id) do nothing;

  select public.upt_create_shift(
    v_rec.workplace_id,
    v_rec.recommended_user_id,
    v_rec.role_name,
    v_rec.scheduled_start,
    v_rec.scheduled_end,
    false,
    'event'
  ) into v_shift;

  update public.planning_recommendations
  set status='applied',applied_shift_id=v_shift,updated_at=now()
  where id=v_rec.id;

  update public.planning_recommendations
  set status='stale',updated_at=now()
  where event_id=v_rec.event_id
    and recommended_user_id=v_rec.recommended_user_id
    and status='proposed'
    and id<>v_rec.id
    and scheduled_start<v_rec.scheduled_end
    and scheduled_end>v_rec.scheduled_start;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'planning.recommendation.applied','planning_recommendation',v_rec.id,jsonb_build_object('shift_id',v_shift));

  return v_shift;
end;
$fn$;

revoke all on function public.upt_apply_planning_recommendation(uuid) from public,anon;
grant execute on function public.upt_apply_planning_recommendation(uuid) to authenticated;

create or replace function public.upt_dismiss_planning_recommendation(p_recommendation uuid)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan planningvoorstellen sluiten.';
  end if;

  update public.planning_recommendations
  set status='dismissed',updated_at=now()
  where id=p_recommendation and status='proposed';

  if not found then raise exception 'Planningvoorstel is niet meer actief.'; end if;
end;
$fn$;

revoke all on function public.upt_dismiss_planning_recommendation(uuid) from public,anon;
grant execute on function public.upt_dismiss_planning_recommendation(uuid) to authenticated;

create or replace function public.upt_update_inventory_asset_metadata(
  p_item uuid,
  p_asset_code text default null,
  p_barcode text default null,
  p_serial_number text default null,
  p_photo_path text default null,
  p_purchase_date date default null,
  p_last_maintenance_at timestamptz default null,
  p_maintenance_due_at timestamptz default null,
  p_location_label text default null,
  p_reorder_threshold integer default 0,
  p_unit_cost_cents integer default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan assetgegevens beheren.';
  end if;
  if p_reorder_threshold is null or p_reorder_threshold<0 or p_reorder_threshold>100000 then raise exception 'Ongeldige minimumvoorraad.'; end if;
  if p_unit_cost_cents is not null and (p_unit_cost_cents<0 or p_unit_cost_cents>1000000000) then raise exception 'Ongeldige kostprijs.'; end if;

  update public.inventory_items
  set asset_code=nullif(trim(coalesce(p_asset_code,'')),''),
      barcode=nullif(trim(coalesce(p_barcode,'')),''),
      serial_number=nullif(trim(coalesce(p_serial_number,'')),''),
      photo_path=nullif(trim(coalesce(p_photo_path,'')),''),
      purchase_date=p_purchase_date,
      last_maintenance_at=p_last_maintenance_at,
      maintenance_due_at=p_maintenance_due_at,
      location_label=nullif(trim(coalesce(p_location_label,'')),''),
      reorder_threshold=p_reorder_threshold,
      unit_cost_cents=p_unit_cost_cents,
      asset_notes=nullif(trim(coalesce(p_notes,'')),''),
      updated_at=now()
  where id=p_item and is_active=true;

  if not found then raise exception 'Materiaal niet gevonden.'; end if;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.asset.updated','inventory_item',p_item,jsonb_build_object(
    'asset_code',nullif(trim(coalesce(p_asset_code,'')),''),
    'barcode',nullif(trim(coalesce(p_barcode,'')),''),
    'maintenance_due_at',p_maintenance_due_at,
    'reorder_threshold',p_reorder_threshold,
    'unit_cost_cents',p_unit_cost_cents
  ));
end;
$fn$;

revoke all on function public.upt_update_inventory_asset_metadata(uuid,text,text,text,text,date,timestamptz,timestamptz,text,integer,integer,text)
from public,anon;
grant execute on function public.upt_update_inventory_asset_metadata(uuid,text,text,text,text,date,timestamptz,timestamptz,text,integer,integer,text)
to authenticated;

create or replace function public.upt_inventory_asset_by_code(p_code text)
returns table(
  id uuid,event_id uuid,workplace_id uuid,name text,category text,asset_code text,
  barcode text,serial_number text,location_label text,maintenance_due_at timestamptz,
  available_quantity integer,total_quantity integer
)
language sql
stable
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
  select
    i.id,i.event_id,i.workplace_id,i.name,i.category,i.asset_code,
    i.barcode,i.serial_number,i.location_label,i.maintenance_due_at,
    i.available_quantity,i.total_quantity
  from public.inventory_items i
  where public.upt_is_approved()
    and i.is_active=true
    and (
      lower(coalesce(i.asset_code,''))=lower(trim(coalesce(p_code,'')))
      or lower(coalesce(i.barcode,''))=lower(trim(coalesce(p_code,'')))
    )
    and upt_private.inventory_can_view(i.event_id,i.workplace_id)
  limit 1;
$fn$;

revoke all on function public.upt_inventory_asset_by_code(text) from public,anon;
grant execute on function public.upt_inventory_asset_by_code(text) to authenticated;

create or replace function upt_private.build_event_report(p_event uuid)
returns jsonb
language sql
stable
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
  with ev as (
    select * from public.events where id=p_event
  ),
  planned as (
    select
      count(distinct s.user_id)::integer as planned_crew,
      coalesce(sum(greatest(0,extract(epoch from (s.scheduled_end-s.scheduled_start))/60)),0)::bigint as planned_minutes
    from public.shifts s
    where s.event_id=p_event and s.status<>'cancelled' and s.response_status<>'declined'
  ),
  worked as (
    select
      count(distinct ws.user_id)::integer as attended_crew,
      coalesce(sum(greatest(0,extract(epoch from (coalesce(ws.ended_at,ws.end_time,now())-coalesce(ws.started_at,ws.start_time)))/60)),0)::bigint as worked_minutes
    from public.work_sessions ws
    where ws.event_id=p_event
  ),
  breaks as (
    select coalesce(sum(greatest(0,extract(epoch from (coalesce(bs.ended_at,bs.end_time,now())-coalesce(bs.started_at,bs.start_time)))/60)),0)::bigint as break_minutes
    from public.break_sessions bs
    join public.work_sessions ws on ws.id=bs.work_session_id
    where ws.event_id=p_event
  ),
  task_stats as (
    select
      count(*) filter (where t.status in ('completed','done'))::integer as completed_tasks,
      count(*) filter (where t.status not in ('completed','done'))::integer as incomplete_tasks
    from public.tasks t
    where t.event_id=p_event
  ),
  inventory_stats as (
    select
      coalesce(sum(i.missing_quantity),0)::integer as missing_items,
      coalesce(sum(i.damaged_quantity),0)::integer as damaged_items,
      coalesce(sum(i.missing_quantity*coalesce(i.unit_cost_cents,0)),0)::bigint as missing_value_cents,
      coalesce(sum(i.damaged_quantity*coalesce(i.unit_cost_cents,0)),0)::bigint as damaged_value_cents
    from public.inventory_items i
    where i.event_id=p_event and i.is_active=true
  ),
  session_net as (
    select
      ws.id,
      ws.user_id,
      greatest(
        0,
        extract(epoch from (coalesce(ws.ended_at,ws.end_time,now())-coalesce(ws.started_at,ws.start_time)))/60
        - coalesce((
          select sum(greatest(0,extract(epoch from (coalesce(bs.ended_at,bs.end_time,now())-coalesce(bs.started_at,bs.start_time)))/60))
          from public.break_sessions bs where bs.work_session_id=ws.id
        ),0)
      )::numeric as net_minutes,
      coalesce(ws.started_at,ws.start_time)::date as work_date
    from public.work_sessions ws
    where ws.event_id=p_event
  ),
  cost as (
    select coalesce(sum(
      floor(sn.net_minutes*coalesce(rate.hourly_rate_cents,0)/60.0)
      * coalesce(rate.employer_cost_multiplier_bps,10000)/10000.0
    ),0)::bigint as estimated_staff_cost_cents
    from session_net sn
    left join lateral (
      select r.hourly_rate_cents,r.employer_cost_multiplier_bps
      from public.staff_pay_rates r
      where r.user_id=sn.user_id
        and r.effective_from<=sn.work_date
        and (r.effective_until is null or r.effective_until>=sn.work_date)
      order by r.effective_from desc,r.created_at desc
      limit 1
    ) rate on true
  )
  select jsonb_build_object(
    'eventId',p_event,
    'generatedAt',now(),
    'plannedCrew',planned.planned_crew,
    'attendedCrew',worked.attended_crew,
    'noShows',greatest(0,planned.planned_crew-worked.attended_crew),
    'plannedMinutes',planned.planned_minutes,
    'workedMinutes',worked.worked_minutes,
    'breakMinutes',breaks.break_minutes,
    'netWorkedMinutes',greatest(0,worked.worked_minutes-breaks.break_minutes),
    'varianceMinutes',greatest(0,worked.worked_minutes-breaks.break_minutes)-planned.planned_minutes,
    'incidents',(select count(*)::integer from public.incidents i where i.event_id=p_event),
    'completedTasks',task_stats.completed_tasks,
    'incompleteTasks',task_stats.incomplete_tasks,
    'missingItems',inventory_stats.missing_items,
    'damagedItems',inventory_stats.damaged_items,
    'missingValueCents',inventory_stats.missing_value_cents,
    'damagedValueCents',inventory_stats.damaged_value_cents,
    'estimatedStaffCostCents',cost.estimated_staff_cost_cents,
    'costEstimateOnly',true
  )
  from ev,planned,worked,breaks,task_stats,inventory_stats,cost;
$fn$;

revoke all on function upt_private.build_event_report(uuid) from public,anon,authenticated;

create or replace function public.upt_generate_event_report(p_event uuid)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_snapshot jsonb;
begin
  if v_actor is null or not public.upt_is_approved() or not (
    public.upt_is_admin(v_actor) or public.upt_is_responsible(p_event,null,v_actor)
  ) then raise exception 'Geen toegang tot eventrapport.'; end if;

  v_snapshot:=upt_private.build_event_report(p_event);
  if v_snapshot is null then raise exception 'Evenement niet gevonden.'; end if;

  insert into public.event_report_snapshots(event_id,snapshot,generated_by,generation_kind)
  values(p_event,v_snapshot,v_actor,'manual');

  return v_snapshot;
end;
$fn$;

revoke all on function public.upt_generate_event_report(uuid) from public,anon;
grant execute on function public.upt_generate_event_report(uuid) to authenticated;

create or replace function public.upt_event_payroll_summary(p_event uuid)
returns table(
  user_id uuid,
  full_name text,
  worked_minutes bigint,
  break_minutes bigint,
  net_minutes bigint,
  hourly_rate_cents integer,
  employer_cost_multiplier_bps integer,
  estimated_cost_cents bigint,
  estimate_only boolean
)
language sql
stable
security definer
set search_path='pg_catalog','public'
as $fn$
  with sessions as (
    select
      ws.user_id,
      coalesce(ws.started_at,ws.start_time)::date as work_date,
      greatest(0,extract(epoch from (coalesce(ws.ended_at,ws.end_time,now())-coalesce(ws.started_at,ws.start_time)))/60)::bigint as worked_minutes,
      coalesce((
        select sum(greatest(0,extract(epoch from (coalesce(bs.ended_at,bs.end_time,now())-coalesce(bs.started_at,bs.start_time)))/60))
        from public.break_sessions bs
        where bs.work_session_id=ws.id
      ),0)::bigint as break_minutes
    from public.work_sessions ws
    where ws.event_id=p_event
  ),
  rows as (
    select
      s.user_id,
      p.full_name,
      s.worked_minutes,
      s.break_minutes,
      greatest(0,s.worked_minutes-s.break_minutes)::bigint as net_minutes,
      coalesce(rate.hourly_rate_cents,0)::integer as hourly_rate_cents,
      coalesce(rate.employer_cost_multiplier_bps,10000)::integer as employer_cost_multiplier_bps
    from sessions s
    join public.profiles p on p.id=s.user_id
    left join lateral (
      select r.hourly_rate_cents,r.employer_cost_multiplier_bps
      from public.staff_pay_rates r
      where r.user_id=s.user_id
        and r.effective_from<=s.work_date
        and (r.effective_until is null or r.effective_until>=s.work_date)
      order by r.effective_from desc,r.created_at desc
      limit 1
    ) rate on true
  )
  select
    r.user_id,
    max(r.full_name)::text,
    sum(r.worked_minutes)::bigint,
    sum(r.break_minutes)::bigint,
    sum(r.net_minutes)::bigint,
    max(r.hourly_rate_cents)::integer,
    max(r.employer_cost_multiplier_bps)::integer,
    sum(floor(r.net_minutes*r.hourly_rate_cents/60.0*r.employer_cost_multiplier_bps/10000.0))::bigint,
    true
  from rows r
  where public.upt_is_approved()
    and public.upt_is_admin((select auth.uid()))
  group by r.user_id
  order by max(r.full_name);
$fn$;

revoke all on function public.upt_event_payroll_summary(uuid) from public,anon;
grant execute on function public.upt_event_payroll_summary(uuid) to authenticated;

create or replace function public.upt_complete_event_onboarding_step(
  p_event uuid,
  p_step text
)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_workplace uuid;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_step not in ('briefing','safety','map','workplace','responsible','inventory','confirmed') then raise exception 'Ongeldige onboardingstap.'; end if;
  if not exists(
    select 1
    from public.event_members em
    where em.event_id=p_event and em.user_id=v_actor
    union all
    select 1
    from public.shifts s
    where s.event_id=p_event and s.user_id=v_actor and s.status<>'cancelled'
  ) then raise exception 'Je bent niet aan dit evenement toegewezen.'; end if;

  select s.workplace_id into v_workplace
  from public.shifts s
  where s.event_id=p_event
    and s.user_id=v_actor
    and s.status<>'cancelled'
    and s.response_status<>'declined'
  order by s.scheduled_start
  limit 1;

  if p_step='briefing' and exists(
    select 1
    from public.briefings b
    where b.event_id=p_event
      and b.required=true
      and (b.workplace_id is null or b.workplace_id=v_workplace)
      and not exists(
        select 1
        from public.briefing_acknowledgements a
        where a.briefing_id=b.id and a.user_id=v_actor and a.version=b.version
      )
  ) then
    raise exception 'Bevestig eerst alle verplichte briefings.';
  end if;

  if p_step='confirmed' and (
    select count(*) from public.event_onboarding_progress p
    where p.event_id=p_event and p.user_id=v_actor
      and p.step in ('briefing','safety','map','workplace','responsible','inventory')
  )<6 then
    raise exception 'Rond eerst alle onboardingstappen af.';
  end if;

  insert into public.event_onboarding_progress(event_id,user_id,step,completed_at)
  values(p_event,v_actor,p_step,now())
  on conflict(event_id,user_id,step) do update set completed_at=excluded.completed_at;
end;
$fn$;

revoke all on function public.upt_complete_event_onboarding_step(uuid,text) from public,anon;
grant execute on function public.upt_complete_event_onboarding_step(uuid,text) to authenticated;

create or replace function public.upt_event_onboarding_status(p_event uuid)
returns jsonb
language sql
stable
security definer
set search_path='pg_catalog','public'
as $fn$
  select jsonb_build_object(
    'required',coalesce(e.onboarding_required,true),
    'completed',coalesce((
      select jsonb_agg(p.step order by p.completed_at)
      from public.event_onboarding_progress p
      where p.event_id=e.id and p.user_id=(select auth.uid())
    ),'[]'::jsonb),
    'completedCount',(
      select count(*) from public.event_onboarding_progress p
      where p.event_id=e.id and p.user_id=(select auth.uid())
    ),
    'requiredCount',7,
    'ready',
      not coalesce(e.onboarding_required,true)
      or exists(
        select 1 from public.event_onboarding_progress p
        where p.event_id=e.id and p.user_id=(select auth.uid()) and p.step='confirmed'
      )
  )
  from public.events e
  where e.id=p_event
    and public.upt_is_approved()
    and (
      public.upt_is_admin((select auth.uid()))
      or exists(select 1 from public.event_members em where em.event_id=e.id and em.user_id=(select auth.uid()))
      or exists(select 1 from public.shifts s where s.event_id=e.id and s.user_id=(select auth.uid()) and s.status<>'cancelled')
    );
$fn$;

revoke all on function public.upt_event_onboarding_status(uuid) from public,anon;
grant execute on function public.upt_event_onboarding_status(uuid) to authenticated;

create or replace function public.upt_create_qr_resource(
  p_event uuid,
  p_workplace uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_title text,
  p_route text
)
returns text
language plpgsql
security definer
set search_path='pg_catalog','public','extensions'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_code text;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan QR-resources aanmaken.';
  end if;
  if p_resource_type not in ('workplace','inventory','document','checklist','task','knowledge') then raise exception 'Ongeldig QR-resourcetype.'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 200 then raise exception 'Geef een geldige QR-titel.'; end if;
  if p_route is null or p_route not like '/%' or p_route like '//%' or p_route like '%://%' or length(p_route)>500 then raise exception 'Ongeldige interne route.'; end if;
  if p_workplace is not null and not exists(select 1 from public.workplaces w where w.id=p_workplace and (p_event is null or w.event_id=p_event)) then
    raise exception 'Werkplek niet gevonden.';
  end if;

  v_code:=encode(extensions.gen_random_bytes(10),'hex');
  insert into public.qr_resources(
    code,event_id,workplace_id,resource_type,resource_id,title,route,created_by
  )
  values(v_code,p_event,p_workplace,p_resource_type,p_resource_id,trim(p_title),p_route,v_actor);
  return v_code;
end;
$fn$;

revoke all on function public.upt_create_qr_resource(uuid,uuid,text,uuid,text,text) from public,anon;
grant execute on function public.upt_create_qr_resource(uuid,uuid,text,uuid,text,text) to authenticated;

create or replace function public.upt_resolve_qr_resource(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_resource public.qr_resources%rowtype;
  v_allowed boolean:=false;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  select * into v_resource
  from public.qr_resources
  where lower(code)=lower(trim(coalesce(p_code,''))) and active=true;
  if not found then return null; end if;

  v_allowed:=public.upt_is_admin(v_actor)
    or v_resource.event_id is null
    or public.upt_is_responsible(v_resource.event_id,v_resource.workplace_id,v_actor)
    or exists(
      select 1 from public.shifts s
      where s.user_id=v_actor
        and s.event_id=v_resource.event_id
        and (v_resource.workplace_id is null or s.workplace_id=v_resource.workplace_id)
        and s.status<>'cancelled'
        and s.response_status<>'declined'
    );

  if not v_allowed then raise exception 'Geen toegang tot deze QR-resource.'; end if;

  return jsonb_build_object(
    'id',v_resource.id,
    'type',v_resource.resource_type,
    'resourceId',v_resource.resource_id,
    'eventId',v_resource.event_id,
    'workplaceId',v_resource.workplace_id,
    'title',v_resource.title,
    'route',v_resource.route
  );
end;
$fn$;

revoke all on function public.upt_resolve_qr_resource(text) from public,anon;
grant execute on function public.upt_resolve_qr_resource(text) to authenticated;

create or replace function public.upt_command_center(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_event public.events%rowtype;
  v_workplaces jsonb;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if not (
    public.upt_is_admin(v_actor)
    or public.upt_is_responsible(p_event,null,v_actor)
  ) then raise exception 'Geen toegang tot command center.'; end if;

  select * into v_event from public.events where id=p_event;
  if not found then raise exception 'Evenement niet gevonden.'; end if;

  select coalesce(jsonb_agg(row_data order by sort_order,name),'[]'::jsonb)
  into v_workplaces
  from (
    select
      w.sort_order,
      w.name,
      jsonb_build_object(
        'id',w.id,
        'name',w.name,
        'mapX',w.map_x,
        'mapY',w.map_y,
        'mapLabel',w.map_label,
        'minimumStaff',w.minimum_staff,
        'targetStaff',w.target_staff,
        'maximumStaff',w.maximum_staff,
        'activeStaff',(
          select count(*)::integer
          from public.work_sessions ws
          where ws.event_id=p_event
            and ws.ended_at is null
            and upt_private.current_session_workplace(ws.id)=w.id
        ),
        'responsibles',coalesce((
          select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name) order by p.full_name)
          from public.responsible_assignments ra
          join public.profiles p on p.id=ra.user_id
          where ra.event_id=p_event and ra.workplace_id=w.id
        ),'[]'::jsonb),
        'openIncidents',(
          select count(*)::integer
          from public.incidents i
          where i.event_id=p_event and i.workplace_id=w.id and i.resolved_at is null
        ),
        'openAlerts',(
          select count(*)::integer
          from upt_private.operational_alerts a
          where a.event_id=p_event and a.workplace_id=w.id and a.resolved_at is null
        ),
        'lowInventory',(
          select count(*)::integer
          from public.inventory_items i
          where i.event_id=p_event and i.workplace_id=w.id and i.is_active=true
            and i.available_quantity<=i.reorder_threshold
        ),
        'activePeople',coalesce((
          select jsonb_agg(jsonb_build_object(
            'userId',p.id,
            'name',p.full_name,
            'status',case when exists(
              select 1 from public.break_sessions bs
              where bs.work_session_id=ws.id and bs.ended_at is null
            ) then 'break' else 'working' end,
            'startedAt',coalesce(ws.started_at,ws.start_time)
          ) order by p.full_name)
          from public.work_sessions ws
          join public.profiles p on p.id=ws.user_id
          where ws.event_id=p_event
            and ws.ended_at is null
            and upt_private.current_session_workplace(ws.id)=w.id
        ),'[]'::jsonb)
      ) as row_data
    from public.workplaces w
    where w.event_id=p_event
      and w.is_active=true
      and (
        public.upt_is_admin(v_actor)
        or public.upt_is_responsible(p_event,w.id,v_actor)
      )
  ) q;

  return jsonb_build_object(
    'event',jsonb_build_object(
      'id',v_event.id,
      'name',v_event.name,
      'status',v_event.status,
      'startAt',v_event.start_at,
      'endAt',v_event.end_at
    ),
    'workplaces',v_workplaces,
    'refreshedAt',now()
  );
end;
$fn$;

revoke all on function public.upt_command_center(uuid) from public,anon;
grant execute on function public.upt_command_center(uuid) to authenticated;

create or replace function public.upt_set_feature_rollout(
  p_feature_key text,
  p_enabled boolean,
  p_audience text default 'all',
  p_rollout_percentage integer default 100,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan feature-rollouts beheren.'; end if;
  if p_feature_key is null or length(trim(p_feature_key)) not between 1 and 120 then raise exception 'Ongeldige feature key.'; end if;
  if p_audience not in ('all','admin','responsible','staff') then raise exception 'Ongeldige doelgroep.'; end if;
  if p_rollout_percentage is null or p_rollout_percentage not between 0 and 100 then raise exception 'Ongeldig rolloutpercentage.'; end if;

  insert into public.feature_rollouts(feature_key,enabled,audience,rollout_percentage,notes,updated_by,updated_at)
  values(trim(p_feature_key),p_enabled,p_audience,p_rollout_percentage,nullif(trim(coalesce(p_notes,'')),''),v_actor,now())
  on conflict(feature_key) do update set
    enabled=excluded.enabled,
    audience=excluded.audience,
    rollout_percentage=excluded.rollout_percentage,
    notes=excluded.notes,
    updated_by=v_actor,
    updated_at=now();

  insert into public.upt_audit_logs(actor_id,action,entity_type,metadata)
  values(v_actor,'feature.rollout.updated','feature_rollout',jsonb_build_object(
    'feature_key',trim(p_feature_key),
    'enabled',p_enabled,
    'audience',p_audience,
    'rollout_percentage',p_rollout_percentage
  ));
end;
$fn$;

revoke all on function public.upt_set_feature_rollout(text,boolean,text,integer,text) from public,anon;
grant execute on function public.upt_set_feature_rollout(text,boolean,text,integer,text) to authenticated;

create or replace function public.upt_snapshot_platform_configuration(p_note text default null)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_id uuid;
  v_snapshot jsonb;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan configuratieversies maken.'; end if;

  select jsonb_build_object(
    'featureRollouts',coalesce((select jsonb_agg(to_jsonb(fr) order by fr.feature_key) from public.feature_rollouts fr),'[]'::jsonb),
    'roleUiRules',coalesce((select jsonb_agg(to_jsonb(r) order by r.role,r.sort_order,r.feature_key) from public.role_ui_rules r),'[]'::jsonb)
  ) into v_snapshot;

  insert into public.configuration_versions(kind,note,snapshot,created_by)
  values('platform',nullif(trim(coalesce(p_note,'')),''),v_snapshot,v_actor)
  returning id into v_id;

  return v_id;
end;
$fn$;

revoke all on function public.upt_snapshot_platform_configuration(text) from public,anon;
grant execute on function public.upt_snapshot_platform_configuration(text) to authenticated;

create or replace function public.upt_recovery_readiness()
returns jsonb
language sql
stable
security definer
set search_path='pg_catalog','public'
as $fn$
  select case
    when public.upt_is_approved() and public.upt_is_admin((select auth.uid())) then
      jsonb_build_object(
        'objectives',jsonb_build_object(
          'critical',jsonb_build_object('maxDataLossMinutes',15,'maxRecoveryMinutes',60),
          'important',jsonb_build_object('maxDataLossMinutes',60,'maxRecoveryMinutes',240),
          'standard',jsonb_build_object('maxDataLossMinutes',1440,'maxRecoveryMinutes',1440)
        ),
        'latestLogicalCheck',(
          select to_jsonb(r) from public.recovery_checks r
          where r.check_type='logical-health'
          order by r.checked_at desc limit 1
        ),
        'physicalRestoreProof','pending',
        'physicalRestoreProofRequired',true
      )
    else null
  end;
$fn$;

revoke all on function public.upt_recovery_readiness() from public,anon;
grant execute on function public.upt_recovery_readiness() to authenticated;

-- Seed the requested production features in controlled admin rollout.
insert into public.feature_rollouts(feature_key,enabled,audience,rollout_percentage,notes,updated_by)
select v.feature_key,true,v.audience,100,'Platform upgrade 2026-09-28',p.id
from (
  values
    ('autoPlanning','admin'),
    ('eventTemplates','admin'),
    ('smartAlerts','admin'),
    ('assetManagement','admin'),
    ('commandCenter','admin'),
    ('postEventReports','admin'),
    ('costEstimates','admin'),
    ('availabilityWindows','all'),
    ('shiftMarketplace','all'),
    ('eventOnboarding','all'),
    ('qrResources','all'),
    ('incidentSafety','all'),
    ('knowledgeBase','all'),
    ('adminAiAssistant','admin'),
    ('godAudit','admin'),
    ('configurationVersions','admin'),
    ('stagingReadiness','admin'),
    ('recoveryReadiness','admin'),
    ('offlineOperations','all')
) as v(feature_key,audience)
cross join lateral (
  select id from public.profiles
  where approved=true and role='admin'
  order by updated_at nulls last
  limit 1
) p
on conflict(feature_key) do update set
  enabled=excluded.enabled,
  audience=excluded.audience,
  rollout_percentage=excluded.rollout_percentage,
  notes=excluded.notes,
  updated_at=now();

notify pgrst,'reload schema';

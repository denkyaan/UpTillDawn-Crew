-- Platform Expansion: workforce planning, skills, assets, payroll estimates, onboarding,
-- knowledge base, feature rollouts, command-center alerts, reports and operational QR targets.
-- All public tables use RLS. Mutations are deliberately admin-only unless stated otherwise.

create table if not exists public.crew_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  level integer not null default 1 check (level between 1 and 5),
  certificate_reference text,
  expires_at date,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);

create table if not exists public.workplace_skill_requirements (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  skill_name text not null check (length(trim(skill_name)) between 1 and 120),
  minimum_level integer not null default 1 check (minimum_level between 1 and 5),
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique(workplace_id,skill_name)
);

create table if not exists public.inventory_assets (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  asset_tag text not null unique check (length(trim(asset_tag)) between 1 and 120),
  serial_number text,
  photo_path text,
  purchase_date date,
  next_maintenance_at date,
  status text not null default 'available'
    check (status in ('available','issued','maintenance','damaged','missing','retired')),
  assigned_user_id uuid references public.profiles(id) on delete set null,
  notes text check (notes is null or length(notes)<=2000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_pay_rates (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  hourly_rate_cents integer not null check (hourly_rate_cents between 0 and 1000000),
  overtime_multiplier numeric(5,2) not null default 1.50 check (overtime_multiplier between 1 and 10),
  effective_from date not null default current_date,
  notes text check (notes is null or length(notes)<=1000),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.event_onboarding_progress (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  steps jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(event_id,user_id),
  check (jsonb_typeof(steps)='object')
);

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  workplace_id uuid references public.workplaces(id) on delete cascade,
  category text,
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null check (length(trim(body)) between 1 and 20000),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (category is null or length(category)<=120)
);

create table if not exists public.feature_rollouts (
  key text primary key check (length(trim(key)) between 1 and 120),
  enabled boolean not null default false,
  audience text not null default 'all' check (audience in ('all','admin','responsible','employee')),
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(settings)='object')
);

create table if not exists public.platform_alerts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  workplace_id uuid references public.workplaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in (
    'low-inventory','missing-responsible','briefing-unconfirmed',
    'checklist-overdue','asset-maintenance','open-shift'
  )),
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  title text not null check (length(trim(title)) between 1 and 200),
  body text,
  action_path text check (action_path is null or action_path ~ '^/[A-Za-z0-9_/?#&=.-]*$'),
  metadata jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (jsonb_typeof(metadata)='object')
);

create unique index if not exists platform_alerts_open_scope_idx
on public.platform_alerts(
  kind,
  coalesce(event_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(workplace_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(user_id,'00000000-0000-0000-0000-000000000000'::uuid)
)
where resolved_at is null;

create table if not exists public.event_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  generated_by uuid not null references public.profiles(id) on delete restrict,
  report jsonb not null,
  generated_at timestamptz not null default now(),
  check (jsonb_typeof(report)='object')
);

create table if not exists public.operational_qr_targets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  workplace_id uuid references public.workplaces(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 160),
  target_type text not null check (target_type in ('attendance','workplace','inventory','checklist','incident','knowledge','task')),
  action_path text not null check (action_path ~ '^/[A-Za-z0-9_/?#&=.-]*$'),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.incidents
  add column if not exists category text not null default 'general'
    check (category in ('medical','safety','security','equipment','technical','staff','general')),
  add column if not exists urgency text not null default 'normal'
    check (urgency in ('normal','high','urgent')),
  add column if not exists action_taken text;

create index if not exists crew_skills_user_idx on public.crew_skills(user_id);
create index if not exists workplace_skill_requirements_workplace_idx on public.workplace_skill_requirements(workplace_id);
create index if not exists inventory_assets_item_idx on public.inventory_assets(item_id);
create index if not exists inventory_assets_assigned_user_idx on public.inventory_assets(assigned_user_id) where assigned_user_id is not null;
create index if not exists event_onboarding_progress_user_idx on public.event_onboarding_progress(user_id);
create index if not exists knowledge_articles_event_workplace_idx on public.knowledge_articles(event_id,workplace_id) where is_active=true;
create index if not exists platform_alerts_open_event_idx on public.platform_alerts(event_id,workplace_id,detected_at) where resolved_at is null;
create index if not exists event_report_snapshots_event_idx on public.event_report_snapshots(event_id,generated_at desc);
create index if not exists operational_qr_targets_event_idx on public.operational_qr_targets(event_id,workplace_id) where is_active=true;

alter table public.crew_skills enable row level security;
alter table public.workplace_skill_requirements enable row level security;
alter table public.inventory_assets enable row level security;
alter table public.staff_pay_rates enable row level security;
alter table public.event_onboarding_progress enable row level security;
alter table public.knowledge_articles enable row level security;
alter table public.feature_rollouts enable row level security;
alter table public.platform_alerts enable row level security;
alter table public.event_report_snapshots enable row level security;
alter table public.operational_qr_targets enable row level security;

revoke all on table public.crew_skills, public.workplace_skill_requirements, public.inventory_assets,
  public.staff_pay_rates, public.event_onboarding_progress, public.knowledge_articles,
  public.feature_rollouts, public.platform_alerts, public.event_report_snapshots,
  public.operational_qr_targets from anon;

grant select on table public.crew_skills, public.workplace_skill_requirements, public.inventory_assets,
  public.event_onboarding_progress, public.knowledge_articles, public.feature_rollouts,
  public.platform_alerts, public.event_report_snapshots, public.operational_qr_targets to authenticated;
grant select,insert,update,delete on table public.crew_skills, public.workplace_skill_requirements,
  public.inventory_assets, public.staff_pay_rates, public.knowledge_articles,
  public.feature_rollouts, public.operational_qr_targets to authenticated;
grant select,insert on table public.event_report_snapshots to authenticated;

drop policy if exists crew_skills_read on public.crew_skills;
create policy crew_skills_read on public.crew_skills
for select to authenticated
using (
  public.upt_is_approved()
  and (
    user_id=(select auth.uid())
    or public.upt_is_admin((select auth.uid()))
    or public.upt_effective_role((select auth.uid()))='responsible_lead'
  )
);
drop policy if exists crew_skills_admin on public.crew_skills;
create policy crew_skills_admin on public.crew_skills
for all to authenticated
using (public.upt_is_admin((select auth.uid())))
with check (public.upt_is_admin((select auth.uid())));

drop policy if exists workplace_skill_requirements_read on public.workplace_skill_requirements;
create policy workplace_skill_requirements_read on public.workplace_skill_requirements
for select to authenticated
using (public.upt_is_approved());
drop policy if exists workplace_skill_requirements_admin on public.workplace_skill_requirements;
create policy workplace_skill_requirements_admin on public.workplace_skill_requirements
for all to authenticated
using (public.upt_is_admin((select auth.uid())))
with check (public.upt_is_admin((select auth.uid())));

drop policy if exists inventory_assets_read on public.inventory_assets;
create policy inventory_assets_read on public.inventory_assets
for select to authenticated
using (
  exists(
    select 1 from public.inventory_items i
    where i.id=inventory_assets.item_id
      and upt_private.inventory_can_view(i.event_id,i.workplace_id)
  )
);
drop policy if exists inventory_assets_admin on public.inventory_assets;
create policy inventory_assets_admin on public.inventory_assets
for all to authenticated
using (public.upt_is_admin((select auth.uid())))
with check (public.upt_is_admin((select auth.uid())));

drop policy if exists staff_pay_rates_admin on public.staff_pay_rates;
create policy staff_pay_rates_admin on public.staff_pay_rates
for all to authenticated
using (public.upt_is_admin((select auth.uid())))
with check (public.upt_is_admin((select auth.uid())));

drop policy if exists event_onboarding_progress_read on public.event_onboarding_progress;
create policy event_onboarding_progress_read on public.event_onboarding_progress
for select to authenticated
using (
  public.upt_is_approved()
  and (
    user_id=(select auth.uid())
    or public.upt_is_admin((select auth.uid()))
    or public.upt_is_responsible(event_id,null,(select auth.uid()))
  )
);

drop policy if exists knowledge_articles_read on public.knowledge_articles;
create policy knowledge_articles_read on public.knowledge_articles
for select to authenticated
using (
  is_active
  and public.upt_is_approved()
  and (
    public.upt_is_admin((select auth.uid()))
    or event_id is null
    or public.upt_is_responsible(event_id,workplace_id,(select auth.uid()))
    or exists(
      select 1 from public.shifts s
      where s.user_id=(select auth.uid())
        and s.event_id=knowledge_articles.event_id
        and (knowledge_articles.workplace_id is null or s.workplace_id=knowledge_articles.workplace_id)
        and s.status<>'cancelled'
        and s.response_status<>'declined'
    )
  )
);
drop policy if exists knowledge_articles_admin on public.knowledge_articles;
create policy knowledge_articles_admin on public.knowledge_articles
for all to authenticated
using (public.upt_is_admin((select auth.uid())))
with check (public.upt_is_admin((select auth.uid())));

drop policy if exists feature_rollouts_read on public.feature_rollouts;
create policy feature_rollouts_read on public.feature_rollouts
for select to authenticated using (public.upt_is_approved());
drop policy if exists feature_rollouts_admin on public.feature_rollouts;
create policy feature_rollouts_admin on public.feature_rollouts
for all to authenticated
using (public.upt_is_admin((select auth.uid())))
with check (public.upt_is_admin((select auth.uid())));

drop policy if exists platform_alerts_read on public.platform_alerts;
create policy platform_alerts_read on public.platform_alerts
for select to authenticated
using (
  public.upt_is_approved()
  and (
    public.upt_is_admin((select auth.uid()))
    or (
      event_id is not null
      and workplace_id is not null
      and public.upt_is_responsible(event_id,workplace_id,(select auth.uid()))
    )
  )
);

drop policy if exists event_report_snapshots_read on public.event_report_snapshots;
create policy event_report_snapshots_read on public.event_report_snapshots
for select to authenticated
using (
  public.upt_is_admin((select auth.uid()))
  or public.upt_is_responsible(event_id,null,(select auth.uid()))
);
drop policy if exists event_report_snapshots_admin_insert on public.event_report_snapshots;
create policy event_report_snapshots_admin_insert on public.event_report_snapshots
for insert to authenticated
with check (public.upt_is_admin((select auth.uid())) and generated_by=(select auth.uid()));

drop policy if exists operational_qr_targets_read on public.operational_qr_targets;
create policy operational_qr_targets_read on public.operational_qr_targets
for select to authenticated
using (
  is_active and public.upt_is_approved()
  and (
    public.upt_is_admin((select auth.uid()))
    or event_id is null
    or public.upt_is_responsible(event_id,workplace_id,(select auth.uid()))
    or exists(
      select 1 from public.shifts s
      where s.user_id=(select auth.uid())
        and s.event_id=operational_qr_targets.event_id
        and (operational_qr_targets.workplace_id is null or s.workplace_id=operational_qr_targets.workplace_id)
        and s.status<>'cancelled'
        and s.response_status<>'declined'
    )
  )
);
drop policy if exists operational_qr_targets_admin on public.operational_qr_targets;
create policy operational_qr_targets_admin on public.operational_qr_targets
for all to authenticated
using (public.upt_is_admin((select auth.uid())))
with check (public.upt_is_admin((select auth.uid())));

create or replace function public.upt_mark_event_onboarding_step(p_event uuid,p_step text)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_steps jsonb;
  v_complete boolean;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_step not in ('briefing','safety','workplace','responsible','inventory','ready') then
    raise exception 'Ongeldige onboardingstap.';
  end if;
  if not exists(
    select 1 from public.event_members em
    where em.event_id=p_event and em.user_id=v_actor
  ) and not exists(
    select 1 from public.shifts s
    where s.event_id=p_event and s.user_id=v_actor and s.status<>'cancelled'
  ) then raise exception 'Geen toegang tot dit evenement.'; end if;

  insert into public.event_onboarding_progress(event_id,user_id,steps,updated_at)
  values(p_event,v_actor,jsonb_build_object(p_step,true),now())
  on conflict(event_id,user_id) do update
    set steps=event_onboarding_progress.steps||jsonb_build_object(p_step,true),
        updated_at=now();

  select steps into v_steps
  from public.event_onboarding_progress
  where event_id=p_event and user_id=v_actor
  for update;

  v_complete :=
    coalesce((v_steps->>'briefing')::boolean,false)
    and coalesce((v_steps->>'safety')::boolean,false)
    and coalesce((v_steps->>'workplace')::boolean,false)
    and coalesce((v_steps->>'responsible')::boolean,false)
    and coalesce((v_steps->>'inventory')::boolean,false)
    and coalesce((v_steps->>'ready')::boolean,false);

  if v_complete then
    update public.event_onboarding_progress
    set completed_at=coalesce(completed_at,now()),updated_at=now()
    where event_id=p_event and user_id=v_actor;
  end if;
end;
$fn$;
revoke all on function public.upt_mark_event_onboarding_step(uuid,text) from public,anon;
grant execute on function public.upt_mark_event_onboarding_step(uuid,text) to authenticated;

create or replace function public.upt_staffing_recommendations(p_event uuid)
returns table(
  workplace_id uuid,
  workplace_name text,
  candidate_user_id uuid,
  candidate_name text,
  skill_score integer,
  required_skill_count integer,
  already_scheduled boolean
)
language sql
stable
security definer
set search_path='pg_catalog','public'
as $fn$
  with candidates as (
    select p.id,p.full_name
    from public.profiles p
    join public.event_availability a on a.user_id=p.id and a.event_id=p_event
    where p.approved=true and a.response='can'
  ),
  requirements as (
    select r.workplace_id,r.skill_name,r.minimum_level
    from public.workplace_skill_requirements r
    join public.workplaces w on w.id=r.workplace_id
    where w.event_id=p_event and r.required=true
  )
  select
    w.id,
    w.name,
    c.id,
    coalesce(c.full_name,'Personeelslid'),
    count(r.skill_name) filter(
      where exists(
        select 1 from public.crew_skills cs
        where cs.user_id=c.id
          and lower(cs.name)=lower(r.skill_name)
          and cs.level>=r.minimum_level
          and (cs.expires_at is null or cs.expires_at>=current_date)
      )
    )::integer as skill_score,
    count(r.skill_name)::integer as required_skill_count,
    exists(
      select 1 from public.shifts s
      where s.event_id=p_event
        and s.workplace_id=w.id
        and s.user_id=c.id
        and s.status<>'cancelled'
    ) as already_scheduled
  from public.workplaces w
  cross join candidates c
  left join requirements r on r.workplace_id=w.id
  where w.event_id=p_event
    and w.is_active=true
    and public.upt_is_admin(auth.uid())
  group by w.id,w.name,c.id,c.full_name
  order by w.sort_order,w.name,
    count(r.skill_name) filter(
      where exists(
        select 1 from public.crew_skills cs
        where cs.user_id=c.id
          and lower(cs.name)=lower(r.skill_name)
          and cs.level>=r.minimum_level
          and (cs.expires_at is null or cs.expires_at>=current_date)
      )
    ) desc,
    c.full_name nulls last;
$fn$;
revoke all on function public.upt_staffing_recommendations(uuid) from public,anon;
grant execute on function public.upt_staffing_recommendations(uuid) to authenticated;

create or replace function public.upt_event_payroll_summary(p_event uuid)
returns table(
  user_id uuid,
  full_name text,
  worked_minutes integer,
  break_minutes integer,
  net_minutes integer,
  hourly_rate_cents integer,
  estimated_cost_cents bigint
)
language sql
stable
security definer
set search_path='pg_catalog','public'
as $fn$
  with work as (
    select
      ws.user_id,
      sum(extract(epoch from (coalesce(ws.ended_at,now())-ws.started_at))/60)::integer as worked_minutes,
      coalesce(sum((
        select coalesce(sum(extract(epoch from (coalesce(bs.ended_at,now())-bs.started_at))/60),0)
        from public.break_sessions bs where bs.work_session_id=ws.id
      )),0)::integer as break_minutes
    from public.work_sessions ws
    where ws.event_id=p_event
    group by ws.user_id
  )
  select
    w.user_id,
    coalesce(p.full_name,'Personeelslid'),
    w.worked_minutes,
    w.break_minutes,
    greatest(0,w.worked_minutes-w.break_minutes) as net_minutes,
    coalesce(r.hourly_rate_cents,0),
    round((greatest(0,w.worked_minutes-w.break_minutes)::numeric/60)*coalesce(r.hourly_rate_cents,0))::bigint
  from work w
  join public.profiles p on p.id=w.user_id
  left join public.staff_pay_rates r on r.user_id=w.user_id
  where public.upt_is_admin(auth.uid())
  order by p.full_name nulls last;
$fn$;
revoke all on function public.upt_event_payroll_summary(uuid) from public,anon;
grant execute on function public.upt_event_payroll_summary(uuid) to authenticated;

create or replace function public.upt_generate_event_report(p_event uuid)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_report jsonb;
  v_id uuid;
begin
  if v_actor is null or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan rapporten genereren.'; end if;
  if not exists(select 1 from public.events where id=p_event) then raise exception 'Evenement niet gevonden.'; end if;

  select jsonb_build_object(
    'event_id',p_event,
    'generated_at',now(),
    'planned_crew',(select count(distinct s.user_id) from public.shifts s where s.event_id=p_event and s.status<>'cancelled'),
    'attended_crew',(select count(distinct ws.user_id) from public.work_sessions ws where ws.event_id=p_event),
    'planned_minutes',coalesce((select sum(extract(epoch from (s.scheduled_end-s.scheduled_start))/60)::bigint from public.shifts s where s.event_id=p_event and s.status<>'cancelled'),0),
    'worked_minutes',coalesce((select sum(extract(epoch from (coalesce(ws.ended_at,now())-ws.started_at))/60)::bigint from public.work_sessions ws where ws.event_id=p_event),0),
    'break_minutes',coalesce((select sum(extract(epoch from (coalesce(bs.ended_at,now())-bs.started_at))/60)::bigint from public.break_sessions bs join public.work_sessions ws on ws.id=bs.work_session_id where ws.event_id=p_event),0),
    'incidents',(select count(*) from public.incidents i where i.event_id=p_event),
    'open_incidents',(select count(*) from public.incidents i where i.event_id=p_event and i.resolved_at is null),
    'tasks_completed',(select count(*) from public.tasks t where t.event_id=p_event and t.status in ('done','completed')),
    'tasks_total',(select count(*) from public.tasks t where t.event_id=p_event),
    'missing_inventory',coalesce((select sum(i.missing_quantity) from public.inventory_items i where i.event_id=p_event),0),
    'damaged_inventory',coalesce((select sum(i.damaged_quantity) from public.inventory_items i where i.event_id=p_event),0),
    'estimated_payroll_cents',coalesce((select sum(x.estimated_cost_cents) from public.upt_event_payroll_summary(p_event) x),0)
  ) into v_report;

  insert into public.event_report_snapshots(event_id,generated_by,report)
  values(p_event,v_actor,v_report)
  returning id into v_id;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'event.report.generated','event_report',v_id,jsonb_build_object('event_id',p_event));

  return v_id;
end;
$fn$;
revoke all on function public.upt_generate_event_report(uuid) from public,anon;
grant execute on function public.upt_generate_event_report(uuid) to authenticated;

create or replace function public.upt_capture_event_template(p_event uuid,p_name text)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_id uuid;
  v_config jsonb;
begin
  if v_actor is null or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan templates beheren.'; end if;
  if p_name is null or length(trim(p_name)) not between 3 and 200 then raise exception 'Geef een geldige templatenaam.'; end if;
  if not exists(select 1 from public.events where id=p_event) then raise exception 'Evenement niet gevonden.'; end if;

  select jsonb_build_object(
    'version',2,
    'source_event_id',p_event,
    'workplaces',coalesce((
      select jsonb_agg(jsonb_build_object(
        'source_id',w.id,'name',w.name,'description',w.description,'sort_order',w.sort_order,
        'minimum_staff',w.minimum_staff,'target_staff',w.target_staff,'maximum_staff',w.maximum_staff
      ) order by w.sort_order,w.name)
      from public.workplaces w where w.event_id=p_event and w.is_active=true
    ),'[]'::jsonb),
    'briefings',coalesce((
      select jsonb_agg(jsonb_build_object(
        'workplace_id',b.workplace_id,'title',b.title,'body',b.body,'required',b.required
      ) order by b.created_at)
      from public.briefings b where b.event_id=p_event
    ),'[]'::jsonb),
    'tasks',coalesce((
      select jsonb_agg(jsonb_build_object(
        'workplace_id',t.workplace_id,'title',t.title,'description',t.description
      ) order by t.created_at)
      from public.tasks t where t.event_id=p_event
    ),'[]'::jsonb),
    'inventory',coalesce((
      select jsonb_agg(jsonb_build_object(
        'workplace_id',i.workplace_id,'name',i.name,'category',i.category,'total_quantity',i.total_quantity
      ) order by i.category,i.name)
      from public.inventory_items i where i.event_id=p_event and i.is_active=true
    ),'[]'::jsonb)
  ) into v_config;

  insert into public.event_templates(name,configuration,created_by)
  values(trim(p_name),v_config,v_actor)
  returning id into v_id;

  return v_id;
end;
$fn$;
revoke all on function public.upt_capture_event_template(uuid,text) from public,anon;
grant execute on function public.upt_capture_event_template(uuid,text) to authenticated;

create or replace function public.upt_apply_event_template(
  p_template uuid,
  p_name text,
  p_start timestamptz,
  p_end timestamptz,
  p_venue text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_config jsonb;
  v_event uuid;
  v_workplace jsonb;
  v_row jsonb;
  v_new_workplace uuid;
  v_map jsonb:='{}'::jsonb;
  v_old uuid;
begin
  if v_actor is null or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan templates toepassen.'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 200 then raise exception 'Geef een evenementnaam.'; end if;
  if p_start is null or p_end is null or p_end<=p_start then raise exception 'Ongeldige evenementuren.'; end if;

  select configuration into v_config from public.event_templates where id=p_template;
  if v_config is null then raise exception 'Template niet gevonden.'; end if;

  insert into public.events(name,venue,address,start_at,end_at,start_date,end_date,created_by)
  values(trim(p_name),nullif(trim(coalesce(p_venue,'')),''),nullif(trim(coalesce(p_address,'')),''),p_start,p_end,p_start,p_end,v_actor)
  returning id into v_event;

  for v_workplace in select * from jsonb_array_elements(coalesce(v_config->'workplaces','[]'::jsonb))
  loop
    insert into public.workplaces(event_id,name,description,sort_order,is_active,minimum_staff,target_staff,maximum_staff)
    values(
      v_event,
      trim(v_workplace->>'name'),
      nullif(v_workplace->>'description',''),
      coalesce((v_workplace->>'sort_order')::integer,0),
      true,
      coalesce((v_workplace->>'minimum_staff')::integer,0),
      coalesce((v_workplace->>'target_staff')::integer,0),
      nullif(v_workplace->>'maximum_staff','')::integer
    )
    returning id into v_new_workplace;
    v_map:=v_map||jsonb_build_object(v_workplace->>'source_id',v_new_workplace);
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(v_config->'briefings','[]'::jsonb))
  loop
    v_old:=nullif(v_row->>'workplace_id','')::uuid;
    insert into public.briefings(event_id,workplace_id,title,body,required,created_by)
    values(v_event,case when v_old is null then null else (v_map->>v_old::text)::uuid end,v_row->>'title',v_row->>'body',coalesce((v_row->>'required')::boolean,true),v_actor);
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(v_config->'tasks','[]'::jsonb))
  loop
    v_old:=nullif(v_row->>'workplace_id','')::uuid;
    insert into public.tasks(event_id,workplace_id,title,description,created_by)
    values(v_event,case when v_old is null then null else (v_map->>v_old::text)::uuid end,v_row->>'title',nullif(v_row->>'description',''),v_actor);
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(v_config->'inventory','[]'::jsonb))
  loop
    v_old:=nullif(v_row->>'workplace_id','')::uuid;
    if v_old is not null and v_map ? v_old::text then
      insert into public.inventory_items(
        event_id,workplace_id,name,category,total_quantity,available_quantity,created_by
      )
      values(
        v_event,(v_map->>v_old::text)::uuid,v_row->>'name',nullif(v_row->>'category',''),
        greatest(0,coalesce((v_row->>'total_quantity')::integer,0)),
        greatest(0,coalesce((v_row->>'total_quantity')::integer,0)),
        v_actor
      );
    end if;
  end loop;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'event.template.applied','event',v_event,jsonb_build_object('template_id',p_template));

  return v_event;
end;
$fn$;
revoke all on function public.upt_apply_event_template(uuid,text,timestamptz,timestamptz,text,text) from public,anon;
grant execute on function public.upt_apply_event_template(uuid,text,timestamptz,timestamptz,text,text) to authenticated;

create or replace function upt_private.refresh_platform_alerts()
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
begin
  -- Low stock.
  update public.platform_alerts a
  set resolved_at=now()
  where a.kind='low-inventory' and a.resolved_at is null
    and not exists(
      select 1 from public.inventory_items i
      where i.event_id=a.event_id and i.workplace_id=a.workplace_id
        and i.is_active=true and i.total_quantity>0
        and i.available_quantity::numeric/i.total_quantity<=0.20
    );

  insert into public.platform_alerts(event_id,workplace_id,kind,severity,title,body,action_path,metadata)
  select distinct i.event_id,i.workplace_id,'low-inventory','warning','Lage voorraad',
    'Minstens één materiaalsoort staat op 20% of minder.','/inventory',
    jsonb_build_object('item_id',i.id,'item_name',i.name,'available',i.available_quantity,'total',i.total_quantity)
  from public.inventory_items i
  join public.events e on e.id=i.event_id
  where i.is_active=true and i.total_quantity>0
    and i.available_quantity::numeric/i.total_quantity<=0.20
    and e.status<>'archived'
  on conflict do nothing;

  -- Missing responsible on operational workplaces.
  update public.platform_alerts a
  set resolved_at=now()
  where a.kind='missing-responsible' and a.resolved_at is null
    and exists(
      select 1 from public.responsible_assignments r
      where r.event_id=a.event_id and r.workplace_id=a.workplace_id
    );

  insert into public.platform_alerts(event_id,workplace_id,kind,severity,title,body,action_path)
  select w.event_id,w.id,'missing-responsible','critical','Verantwoordelijke ontbreekt',
    'Deze werkplek heeft nog geen verantwoordelijke.','/workplaces'
  from public.workplaces w
  join public.events e on e.id=w.event_id
  where w.is_active=true and w.minimum_staff>0
    and e.status in ('published','active')
    and not exists(select 1 from public.responsible_assignments r where r.event_id=w.event_id and r.workplace_id=w.id)
  on conflict do nothing;

  -- Open declined shifts.
  update public.platform_alerts a
  set resolved_at=now()
  where a.kind='open-shift' and a.resolved_at is null
    and not exists(
      select 1 from public.shifts s
      where s.event_id=a.event_id and s.workplace_id=a.workplace_id
        and s.response_status='declined' and s.status<>'cancelled' and s.scheduled_start>now()
    );

  insert into public.platform_alerts(event_id,workplace_id,user_id,kind,severity,title,body,action_path,metadata)
  select s.event_id,s.workplace_id,s.user_id,'open-shift','warning','Open dienst',
    'Een geweigerde dienst heeft nog vervanging nodig.','/shifts',jsonb_build_object('shift_id',s.id)
  from public.shifts s
  where s.response_status='declined' and s.status<>'cancelled' and s.scheduled_start>now()
  on conflict do nothing;

  -- Asset maintenance.
  update public.platform_alerts a
  set resolved_at=now()
  where a.kind='asset-maintenance' and a.resolved_at is null
    and not exists(
      select 1
      from public.inventory_assets x
      join public.inventory_items i on i.id=x.item_id
      where i.event_id=a.event_id and i.workplace_id=a.workplace_id
        and x.status<>'retired'
        and x.next_maintenance_at is not null
        and x.next_maintenance_at<=current_date+7
    );

  insert into public.platform_alerts(event_id,workplace_id,kind,severity,title,body,action_path,metadata)
  select i.event_id,i.workplace_id,'asset-maintenance',
    case when x.next_maintenance_at<current_date then 'critical' else 'warning' end,
    'Materiaalonderhoud nodig',
    x.asset_tag||' heeft onderhoud nodig.','/inventory',
    jsonb_build_object('asset_id',x.id,'asset_tag',x.asset_tag,'next_maintenance_at',x.next_maintenance_at)
  from public.inventory_assets x
  join public.inventory_items i on i.id=x.item_id
  join public.events e on e.id=i.event_id
  where x.status<>'retired'
    and x.next_maintenance_at is not null
    and x.next_maintenance_at<=current_date+7
    and e.status<>'archived'
  on conflict do nothing;
end;
$fn$;
revoke all on function upt_private.refresh_platform_alerts() from public,anon,authenticated;

select cron.schedule(
  'uptilldawn-operational-alerts',
  '* * * * *',
  $$select upt_private.send_shift_reminders(), upt_private.notify_break_allowance(), upt_private.refresh_operational_alerts(), upt_private.refresh_incident_escalations(), upt_private.refresh_platform_alerts()$$
);

insert into public.feature_rollouts(key,enabled,audience,rollout_percentage,settings,updated_by)
select x.key,true,'all',100,'{}'::jsonb,p.id
from (values
  ('smart_staffing'),('event_templates'),('smart_alerts'),('asset_management'),
  ('command_center'),('post_event_reports'),('payroll_estimates'),('availability'),
  ('shift_marketplace'),('event_onboarding'),('operational_qr'),('incident_plus'),
  ('knowledge_base'),('admin_ai'),('god_audit'),('feature_rollouts'),
  ('staging_readiness'),('recovery_readiness'),('offline_operations')
) as x(key)
cross join lateral (
  select id from public.profiles where approved=true and role='admin' order by updated_at nulls last limit 1
) p
on conflict(key) do nothing;

insert into public.role_ui_rules(role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings)
values ('admin','platform','Platform Center','navigation',true,true,'always',125,'{}'::jsonb)
on conflict(role,feature_key) do update
set label=excluded.label,visible=true,enabled=true,condition_key='always',sort_order=excluded.sort_order;

notify pgrst,'reload schema';

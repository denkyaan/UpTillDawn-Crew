create table if not exists public.operational_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  catalog_workplace_id uuid references public.workplace_catalog(id) on delete set null,
  kind text not null check (kind in ('opening','closing','safety','custom')),
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.operational_checklist_templates(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 300),
  required boolean not null default true,
  requires_photo boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists operational_checklist_templates_unique
on public.operational_checklist_templates(coalesce(catalog_workplace_id,'00000000-0000-0000-0000-000000000000'::uuid),kind,lower(title));

alter table public.operational_checklist_templates enable row level security;
alter table public.operational_checklist_template_items enable row level security;

revoke all on public.operational_checklist_templates,public.operational_checklist_template_items from anon;
grant select on public.operational_checklist_templates,public.operational_checklist_template_items to authenticated;

drop policy if exists operational_checklist_templates_read on public.operational_checklist_templates;
create policy operational_checklist_templates_read on public.operational_checklist_templates
for select to authenticated using (public.upt_is_approved() and is_active=true);

drop policy if exists operational_checklist_template_items_read on public.operational_checklist_template_items;
create policy operational_checklist_template_items_read on public.operational_checklist_template_items
for select to authenticated using (
  public.upt_is_approved()
  and exists(
    select 1 from public.operational_checklist_templates t
    where t.id=template_id and t.is_active=true
  )
);

with seed(catalog_name,kind,title,description,items) as (
  values
  ('Inkom & Guestlist','opening','Inkom & Guestlist openen','Controle voor deuren open gaan.',
    '[{"label":"Scanners en toestellen getest","required":true},{"label":"Guestlist en artiestenlijst geladen","required":true},{"label":"Polsbandjes/stempels aanwezig","required":true},{"label":"Escalatiecontact verantwoordelijke gekend","required":true}]'::jsonb),
  ('Inkom & Guestlist','closing','Inkom & Guestlist sluiten','Afsluitcontrole inkom.',
    '[{"label":"Laatste check-ins verwerkt","required":true},{"label":"Scanners en materiaal teruggelegd","required":true},{"label":"Afwijkingen of incidenten gemeld","required":true}]'::jsonb),
  ('Bar/Toog','opening','Bar openen','Bar- en kassacontrole vóór service.',
    '[{"label":"Voorraad en koeling gecontroleerd","required":true},{"label":"Kassa/tokensysteem getest","required":true},{"label":"Werkpost proper en veilig","required":true},{"label":"Breekbaar/defect materiaal gemeld","required":true}]'::jsonb),
  ('Bar/Toog','closing','Bar sluiten','Bar afsluiten na service.',
    '[{"label":"Voorraadverschillen gemeld","required":true},{"label":"Kassa/tokens afgesloten","required":true},{"label":"Werkpost opgeruimd","required":true},{"label":"Defect of ontbrekend materiaal gemeld","required":true}]'::jsonb),
  ('Merch','opening','Merch openen','Merchandise klaarzetten.',
    '[{"label":"Startvoorraad gecontroleerd","required":true},{"label":"Prijzen en betaalmogelijkheden gecontroleerd","required":true},{"label":"Display en werkpost klaar","required":true}]'::jsonb),
  ('Merch','closing','Merch sluiten','Merchandise afsluiten.',
    '[{"label":"Eindvoorraad gecontroleerd","required":true},{"label":"Verkoopafwijkingen gemeld","required":true},{"label":"Materiaal veilig opgeborgen","required":true}]'::jsonb),
  ('Backstage Management','opening','Backstage openen','Hospitality en artiestenopvang voorbereiden.',
    '[{"label":"Artiestenlijst gecontroleerd","required":true},{"label":"Hospitality/drinks voorbereid","required":true},{"label":"Backstage toegang en zones gecontroleerd","required":true},{"label":"Nood- en productiecontacten gekend","required":true}]'::jsonb),
  ('Backstage Management','closing','Backstage sluiten','Backstage afsluiten.',
    '[{"label":"Alle artiesten/hospitality afgerond","required":true},{"label":"Materialen gecontroleerd","required":true},{"label":"Achtergebleven items gemeld","required":true}]'::jsonb),
  ('Opbouw','safety','Opbouw safety check','Veiligheidscontrole tijdens opbouw.',
    '[{"label":"Looproutes en nooduitgangen vrij","required":true},{"label":"Kabels en stroompunten veilig","required":true},{"label":"Constructies stabiel en gezekerd","required":true},{"label":"Risico’s gemeld","required":true}]'::jsonb),
  ('Afbouw','safety','Afbouw safety check','Veiligheidscontrole tijdens afbouw.',
    '[{"label":"Publiek volledig uit operationele zones","required":true},{"label":"Stroom veilig uitgeschakeld waar nodig","required":true},{"label":"Materiaal systematisch verzameld","required":true},{"label":"Schade/incidenten gemeld","required":true}]'::jsonb)
)
insert into public.operational_checklist_templates(catalog_workplace_id,kind,title,description)
select c.id,s.kind,s.title,s.description
from seed s
join public.workplace_catalog c on lower(c.name)=lower(s.catalog_name)
on conflict(coalesce(catalog_workplace_id,'00000000-0000-0000-0000-000000000000'::uuid),kind,lower(title))
do update set description=excluded.description,is_active=true,updated_at=now();

with seed(catalog_name,kind,title,items) as (
  values
  ('Inkom & Guestlist','opening','Inkom & Guestlist openen',
    '[{"label":"Scanners en toestellen getest","required":true},{"label":"Guestlist en artiestenlijst geladen","required":true},{"label":"Polsbandjes/stempels aanwezig","required":true},{"label":"Escalatiecontact verantwoordelijke gekend","required":true}]'::jsonb),
  ('Inkom & Guestlist','closing','Inkom & Guestlist sluiten',
    '[{"label":"Laatste check-ins verwerkt","required":true},{"label":"Scanners en materiaal teruggelegd","required":true},{"label":"Afwijkingen of incidenten gemeld","required":true}]'::jsonb),
  ('Bar/Toog','opening','Bar openen',
    '[{"label":"Voorraad en koeling gecontroleerd","required":true},{"label":"Kassa/tokensysteem getest","required":true},{"label":"Werkpost proper en veilig","required":true},{"label":"Breekbaar/defect materiaal gemeld","required":true}]'::jsonb),
  ('Bar/Toog','closing','Bar sluiten',
    '[{"label":"Voorraadverschillen gemeld","required":true},{"label":"Kassa/tokens afgesloten","required":true},{"label":"Werkpost opgeruimd","required":true},{"label":"Defect of ontbrekend materiaal gemeld","required":true}]'::jsonb),
  ('Merch','opening','Merch openen',
    '[{"label":"Startvoorraad gecontroleerd","required":true},{"label":"Prijzen en betaalmogelijkheden gecontroleerd","required":true},{"label":"Display en werkpost klaar","required":true}]'::jsonb),
  ('Merch','closing','Merch sluiten',
    '[{"label":"Eindvoorraad gecontroleerd","required":true},{"label":"Verkoopafwijkingen gemeld","required":true},{"label":"Materiaal veilig opgeborgen","required":true}]'::jsonb),
  ('Backstage Management','opening','Backstage openen',
    '[{"label":"Artiestenlijst gecontroleerd","required":true},{"label":"Hospitality/drinks voorbereid","required":true},{"label":"Backstage toegang en zones gecontroleerd","required":true},{"label":"Nood- en productiecontacten gekend","required":true}]'::jsonb),
  ('Backstage Management','closing','Backstage sluiten',
    '[{"label":"Alle artiesten/hospitality afgerond","required":true},{"label":"Materialen gecontroleerd","required":true},{"label":"Achtergebleven items gemeld","required":true}]'::jsonb),
  ('Opbouw','safety','Opbouw safety check',
    '[{"label":"Looproutes en nooduitgangen vrij","required":true},{"label":"Kabels en stroompunten veilig","required":true},{"label":"Constructies stabiel en gezekerd","required":true},{"label":"Risico’s gemeld","required":true}]'::jsonb),
  ('Afbouw','safety','Afbouw safety check',
    '[{"label":"Publiek volledig uit operationele zones","required":true},{"label":"Stroom veilig uitgeschakeld waar nodig","required":true},{"label":"Materiaal systematisch verzameld","required":true},{"label":"Schade/incidenten gemeld","required":true}]'::jsonb)
)
insert into public.operational_checklist_template_items(template_id,label,required,requires_photo,sort_order)
select t.id,item->>'label',coalesce((item->>'required')::boolean,true),coalesce((item->>'requires_photo')::boolean,false),ord::integer
from seed s
join public.workplace_catalog c on lower(c.name)=lower(s.catalog_name)
join public.operational_checklist_templates t on t.catalog_workplace_id=c.id and t.kind=s.kind and lower(t.title)=lower(s.title)
cross join lateral jsonb_array_elements(s.items) with ordinality as x(item,ord)
where not exists(
  select 1 from public.operational_checklist_template_items existing
  where existing.template_id=t.id and lower(existing.label)=lower(item->>'label')
);

create or replace function public.upt_apply_operational_checklist_template(
  p_template uuid,p_event uuid,p_workplace uuid
)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_actor uuid:=auth.uid();
  v_template public.operational_checklist_templates%rowtype;
  v_workplace public.workplaces%rowtype;
  v_checklist uuid;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  select * into v_template from public.operational_checklist_templates where id=p_template and is_active=true;
  if not found then raise exception 'Checklisttemplate niet gevonden.'; end if;
  select * into v_workplace from public.workplaces where id=p_workplace and event_id=p_event and is_active=true;
  if not found then raise exception 'Werkplek niet gevonden.'; end if;
  if not public.upt_is_admin(v_actor) and not public.upt_is_responsible(p_event,p_workplace,v_actor) then raise exception 'Geen toegang.'; end if;
  if v_template.catalog_workplace_id is not null and v_workplace.catalog_workplace_id is distinct from v_template.catalog_workplace_id then
    raise exception 'Deze template hoort bij een andere werkplek.';
  end if;

  insert into public.operational_checklists(event_id,workplace_id,kind,title,description,status,created_by)
  values(p_event,p_workplace,v_template.kind,v_template.title,v_template.description,'open',v_actor)
  returning id into v_checklist;

  insert into public.checklist_items(checklist_id,label,required,requires_photo,sort_order)
  select v_checklist,label,required,requires_photo,sort_order
  from public.operational_checklist_template_items
  where template_id=p_template order by sort_order,created_at;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'checklist.template.applied','operational_checklist',v_checklist,
    jsonb_build_object('template_id',p_template,'event_id',p_event,'workplace_id',p_workplace));

  return v_checklist;
end;
$$;
revoke all on function public.upt_apply_operational_checklist_template(uuid,uuid,uuid) from public,anon;
grant execute on function public.upt_apply_operational_checklist_template(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';

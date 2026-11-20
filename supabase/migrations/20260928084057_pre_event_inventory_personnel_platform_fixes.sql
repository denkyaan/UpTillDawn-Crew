grant execute on function upt_private.inventory_can_view(uuid,uuid) to authenticated;

create table if not exists public.workplace_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  is_active boolean not null default true,
  minimum_staff integer not null default 0 check (minimum_staff between 0 and 10000),
  target_staff integer not null default 0 check (target_staff between 0 and 10000),
  maximum_staff integer check (maximum_staff is null or maximum_staff between 0 and 10000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(name)) between 1 and 200),
  check (length(coalesce(description,'')) <= 1000),
  check (minimum_staff <= target_staff),
  check (maximum_staff is null or target_staff <= maximum_staff)
);
create unique index if not exists workplace_catalog_name_unique on public.workplace_catalog(lower(name));

create table if not exists public.workplace_catalog_items (
  id uuid primary key default gen_random_uuid(),
  catalog_workplace_id uuid not null references public.workplace_catalog(id) on delete cascade,
  name text not null,
  category text,
  default_quantity integer not null default 1 check (default_quantity between 0 and 100000),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(name)) between 1 and 200),
  check (category is null or length(category) <= 120)
);
create unique index if not exists workplace_catalog_items_name_unique
on public.workplace_catalog_items(catalog_workplace_id,lower(name));

alter table public.workplaces add column if not exists catalog_workplace_id uuid references public.workplace_catalog(id) on delete set null;
create unique index if not exists workplaces_event_catalog_unique
on public.workplaces(event_id,catalog_workplace_id) where catalog_workplace_id is not null;

alter table public.inventory_items add column if not exists catalog_item_id uuid references public.workplace_catalog_items(id) on delete set null;
create unique index if not exists inventory_items_event_catalog_unique
on public.inventory_items(event_id,catalog_item_id) where catalog_item_id is not null;

alter table public.workplace_catalog enable row level security;
alter table public.workplace_catalog_items enable row level security;
revoke all on public.workplace_catalog,public.workplace_catalog_items from anon;
revoke insert,update,delete on public.workplace_catalog,public.workplace_catalog_items from authenticated;
grant select on public.workplace_catalog,public.workplace_catalog_items to authenticated;

drop policy if exists workplace_catalog_admin_read on public.workplace_catalog;
create policy workplace_catalog_admin_read on public.workplace_catalog
for select to authenticated
using (public.upt_is_approved() and public.upt_is_admin((select auth.uid())));

drop policy if exists workplace_catalog_items_admin_read on public.workplace_catalog_items;
create policy workplace_catalog_items_admin_read on public.workplace_catalog_items
for select to authenticated
using (public.upt_is_approved() and public.upt_is_admin((select auth.uid())));

create or replace function public.upt_create_workplace_catalog(
  p_name text,p_description text default null,p_sort_order integer default 0,
  p_minimum_staff integer default 0,p_target_staff integer default 0,p_maximum_staff integer default null
) returns uuid
language plpgsql security definer set search_path='pg_catalog','public'
as $fn$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan standaardwerkplekken beheren.'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 200 then raise exception 'Geef een geldige werkpleknaam.'; end if;
  if p_sort_order not between 0 and 10000 then raise exception 'Ongeldige volgorde.'; end if;
  if p_minimum_staff<0 or p_target_staff<0 or p_minimum_staff>p_target_staff or (p_maximum_staff is not null and p_target_staff>p_maximum_staff) then raise exception 'Bezetting moet voldoen aan minimum ≤ doel ≤ maximum.'; end if;
  insert into public.workplace_catalog(name,description,sort_order,minimum_staff,target_staff,maximum_staff,created_by)
  values(trim(p_name),nullif(trim(coalesce(p_description,'')),''),p_sort_order,p_minimum_staff,p_target_staff,p_maximum_staff,v_actor)
  returning id into v_id;
  return v_id;
end
$fn$;
revoke all on function public.upt_create_workplace_catalog(text,text,integer,integer,integer,integer) from public,anon;
grant execute on function public.upt_create_workplace_catalog(text,text,integer,integer,integer,integer) to authenticated;

create or replace function public.upt_update_workplace_catalog(
  p_workplace uuid,p_name text,p_description text default null,p_sort_order integer default 0,
  p_minimum_staff integer default 0,p_target_staff integer default 0,p_maximum_staff integer default null,
  p_is_active boolean default true
) returns void
language plpgsql security definer set search_path='pg_catalog','public'
as $fn$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan standaardwerkplekken beheren.'; end if;
  update public.workplace_catalog
  set name=trim(p_name),description=nullif(trim(coalesce(p_description,'')),''),
      sort_order=p_sort_order,minimum_staff=p_minimum_staff,target_staff=p_target_staff,
      maximum_staff=p_maximum_staff,is_active=coalesce(p_is_active,true),updated_at=now()
  where id=p_workplace;
  if not found then raise exception 'Standaardwerkplek niet gevonden.'; end if;
end
$fn$;
revoke all on function public.upt_update_workplace_catalog(uuid,text,text,integer,integer,integer,integer,boolean) from public,anon;
grant execute on function public.upt_update_workplace_catalog(uuid,text,text,integer,integer,integer,integer,boolean) to authenticated;

create or replace function public.upt_create_workplace_catalog_item(
  p_workplace uuid,p_name text,p_category text default null,p_quantity integer default 1
) returns uuid
language plpgsql security definer set search_path='pg_catalog','public'
as $fn$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan standaardinventaris beheren.'; end if;
  insert into public.workplace_catalog_items(catalog_workplace_id,name,category,default_quantity,created_by)
  values(p_workplace,trim(p_name),nullif(trim(coalesce(p_category,'')),''),p_quantity,v_actor)
  returning id into v_id;
  return v_id;
end
$fn$;
revoke all on function public.upt_create_workplace_catalog_item(uuid,text,text,integer) from public,anon;
grant execute on function public.upt_create_workplace_catalog_item(uuid,text,text,integer) to authenticated;

create or replace function public.upt_update_workplace_catalog_item(
  p_item uuid,p_name text,p_category text default null,p_quantity integer default 1,p_is_active boolean default true
) returns void
language plpgsql security definer set search_path='pg_catalog','public'
as $fn$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan standaardinventaris beheren.'; end if;
  update public.workplace_catalog_items
  set name=trim(p_name),category=nullif(trim(coalesce(p_category,'')),''),
      default_quantity=p_quantity,is_active=coalesce(p_is_active,true),updated_at=now()
  where id=p_item;
  if not found then raise exception 'Standaardmateriaal niet gevonden.'; end if;
end
$fn$;
revoke all on function public.upt_update_workplace_catalog_item(uuid,text,text,integer,boolean) from public,anon;
grant execute on function public.upt_update_workplace_catalog_item(uuid,text,text,integer,boolean) to authenticated;

create or replace function public.upt_sync_workplace_catalog_to_event(p_event uuid)
returns jsonb
language plpgsql security definer set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_catalog public.workplace_catalog%rowtype;
  v_item public.workplace_catalog_items%rowtype;
  v_workplace uuid;
  v_workplaces integer:=0;
  v_items integer:=0;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan standaardwerkplekken synchroniseren.'; end if;
  if not exists(select 1 from public.events where id=p_event) then raise exception 'Evenement niet gevonden.'; end if;

  for v_catalog in select * from public.workplace_catalog where is_active=true order by sort_order,name loop
    insert into public.workplaces(
      event_id,name,description,sort_order,is_active,minimum_staff,target_staff,maximum_staff,catalog_workplace_id
    ) values(
      p_event,v_catalog.name,v_catalog.description,v_catalog.sort_order,true,
      v_catalog.minimum_staff,v_catalog.target_staff,v_catalog.maximum_staff,v_catalog.id
    )
    on conflict(event_id,catalog_workplace_id) where catalog_workplace_id is not null
    do update set name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,
      minimum_staff=excluded.minimum_staff,target_staff=excluded.target_staff,maximum_staff=excluded.maximum_staff,is_active=true
    returning id into v_workplace;
    v_workplaces:=v_workplaces+1;

    for v_item in select * from public.workplace_catalog_items where catalog_workplace_id=v_catalog.id and is_active=true order by category,name loop
      insert into public.inventory_items(
        event_id,workplace_id,name,category,total_quantity,available_quantity,issued_quantity,
        damaged_quantity,missing_quantity,is_active,created_by,catalog_item_id
      ) values(
        p_event,v_workplace,v_item.name,v_item.category,v_item.default_quantity,v_item.default_quantity,0,0,0,true,v_actor,v_item.id
      )
      on conflict(event_id,catalog_item_id) where catalog_item_id is not null
      do update set name=excluded.name,category=excluded.category,workplace_id=excluded.workplace_id,is_active=true,updated_at=now();
      v_items:=v_items+1;
    end loop;
  end loop;
  return jsonb_build_object('workplaces',v_workplaces,'items',v_items);
end
$fn$;
revoke all on function public.upt_sync_workplace_catalog_to_event(uuid) from public,anon;
grant execute on function public.upt_sync_workplace_catalog_to_event(uuid) to authenticated;

alter table public.profiles
  add column if not exists account_blocked boolean not null default false,
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text,
  add column if not exists blocked_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_before_block boolean;

create or replace function public.upt_admin_set_personnel_block(p_user uuid,p_blocked boolean,p_reason text default null)
returns void
language plpgsql security definer set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_actor uuid:=auth.uid(); v_profile public.profiles%rowtype; v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Geen toegang.'; end if;
  if p_user=v_actor then raise exception 'Je kunt je eigen account niet blokkeren.'; end if;
  if upt_private.is_app_owner(p_user) then raise exception 'De maker van de app kan niet worden geblokkeerd.'; end if;
  select * into v_profile from public.profiles where id=p_user for update;
  if not found then raise exception 'Gebruiker niet gevonden.'; end if;
  if p_blocked then
    update public.profiles set approved_before_block=case when account_blocked then approved_before_block else approved end,
      approved=false,account_blocked=true,blocked_at=now(),blocked_reason=v_reason,blocked_by=v_actor,updated_at=now()
    where id=p_user;
  else
    update public.profiles set approved=coalesce(approved_before_block,false),account_blocked=false,blocked_at=null,
      blocked_reason=null,blocked_by=null,approved_before_block=null,updated_at=now()
    where id=p_user;
  end if;
end
$fn$;
revoke all on function public.upt_admin_set_personnel_block(uuid,boolean,text) from public,anon;
grant execute on function public.upt_admin_set_personnel_block(uuid,boolean,text) to authenticated;

create or replace function public.upt_admin_personnel_details_v2()
returns table(
  id uuid,email text,full_name text,home_address text,phone_number text,date_of_birth date,
  national_register_number text,iban text,profile_photo_url text,approved boolean,role text,
  updated_at timestamptz,account_blocked boolean,blocked_at timestamptz,blocked_reason text
)
language plpgsql stable security definer set search_path='public','auth','pg_temp'
as $fn$
begin
  if not public.upt_is_admin(auth.uid()) then raise exception 'Geen toegang.'; end if;
  return query
  select p.id,u.email::text,p.full_name,p.home_address,p.phone_number,p.date_of_birth,
         p.national_register_number,p.iban,p.profile_photo_url,p.approved,p.role,p.updated_at,
         p.account_blocked,p.blocked_at,p.blocked_reason
  from public.profiles p left join auth.users u on u.id=p.id
  order by p.full_name nulls last,u.email;
end
$fn$;
revoke all on function public.upt_admin_personnel_details_v2() from public,anon;
grant execute on function public.upt_admin_personnel_details_v2() to authenticated;

create or replace function public.upt_admin_set_account(p_user uuid,p_approved boolean,p_role text)
returns void
language plpgsql security definer
set search_path to 'pg_catalog','public','upt_private','auth','storage'
as $fn$
declare v_actor uuid:=auth.uid();
begin
  if not public.upt_is_admin() then raise exception 'Not authorized'; end if;
  if p_role='__delete__' then
    if p_user=v_actor then raise exception 'Je kunt je eigen account niet verwijderen.'; end if;
    if upt_private.is_app_owner(p_user) then raise exception 'Een app-eigenaar kan niet via personeelsbeheer worden verwijderd.'; end if;
    if not exists(select 1 from auth.users where id=p_user) then raise exception 'Gebruiker niet gevonden.'; end if;
    if exists(select 1 from public.inventory_issues where user_id=p_user and outstanding_quantity>0) then raise exception 'Werk eerst het uitstaande materiaal van deze gebruiker af.'; end if;
    update storage.objects set owner=v_actor,owner_id=v_actor::text where owner=p_user or owner_id=p_user::text;
    update public.messages set sender_id=null where sender_id=p_user;
    update public.check_ins set approved_by=null where approved_by=p_user;
    update public.incidents set resolved_by=null where resolved_by=p_user;
    delete from public.incidents where reporter_id=p_user;
    delete from public.time_corrections where corrected_by=p_user;
    delete from public.work_attachments where uploaded_by=p_user;
    delete from public.inventory_settlement_requests where user_id=p_user;
    delete from public.inventory_issues where user_id=p_user;
    delete from auth.users where id=p_user;
    return;
  end if;
  if p_role not in ('admin','responsible_lead','staff') or p_role is null or p_approved is null then raise exception 'Invalid role'; end if;
  if upt_private.is_app_owner(p_user) and not p_approved then raise exception 'De maker van de app kan niet worden gedeactiveerd.'; end if;
  if p_user=v_actor and not upt_private.is_app_owner(p_user) and (not p_approved or p_role<>'admin') then raise exception 'Cannot revoke own admin access'; end if;
  update public.profiles set approved=case when upt_private.is_app_owner(p_user) then true else p_approved end,role=p_role where id=p_user;
  if not found then raise exception 'Profile not found'; end if;
  if upt_private.is_app_owner(p_user) then
    insert into public.admin_role_modes(user_id,active_role,updated_at) values(p_user,p_role,now())
    on conflict(user_id) do update set active_role=excluded.active_role,updated_at=excluded.updated_at;
  end if;
end
$fn$;

insert into public.role_ui_rules(role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings)
values('admin','platform','Platformbeheer','navigation',true,true,'always',125,'{}'::jsonb)
on conflict(role,feature_key) do update set label='Platformbeheer',visible=true,enabled=true,condition_key='always',sort_order=125;

notify pgrst,'reload schema';
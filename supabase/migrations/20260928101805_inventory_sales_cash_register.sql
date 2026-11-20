
alter table public.inventory_items
  add column if not exists sale_enabled boolean not null default false,
  add column if not exists sale_category text,
  add column if not exists sale_price_cents integer;

alter table public.inventory_items
  drop constraint if exists inventory_items_sale_config_check;
alter table public.inventory_items
  add constraint inventory_items_sale_config_check check (
    sale_enabled=false
    or (
      sale_category in('merch','token')
      and sale_price_cents is not null
      and sale_price_cents between 0 and 10000000
    )
  );

alter table public.inventory_movements
  drop constraint if exists inventory_movements_movement_type_check;
alter table public.inventory_movements
  add constraint inventory_movements_movement_type_check check (
    movement_type in(
      'created','restocked','issued','returned','damaged','missing',
      'restored-damaged','restored-missing','sold','sale-refund'
    )
  );

create table if not exists public.sales_transactions(
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  seller_id uuid references public.profiles(id) on delete set null,
  transaction_type text not null default 'sale',
  original_sale_id uuid references public.sales_transactions(id) on delete restrict,
  product_name text not null,
  sale_category text not null,
  quantity integer not null,
  unit_price_cents integer not null,
  total_cents bigint generated always as ((quantity::bigint)*(unit_price_cents::bigint)) stored,
  payment_method text not null,
  notes text,
  created_at timestamptz not null default now(),
  check(transaction_type in('sale','refund')),
  check(sale_category in('merch','token')),
  check(quantity between 1 and 10000),
  check(unit_price_cents between 0 and 10000000),
  check(payment_method in('cash','card')),
  check(length(product_name) between 1 and 200),
  check(notes is null or length(notes)<=1000),
  check((transaction_type='sale' and original_sale_id is null) or (transaction_type='refund' and original_sale_id is not null))
);

create index if not exists sales_transactions_event_created_idx
on public.sales_transactions(event_id,created_at desc);
create index if not exists sales_transactions_workplace_created_idx
on public.sales_transactions(workplace_id,created_at desc);
create index if not exists sales_transactions_item_idx
on public.sales_transactions(inventory_item_id,created_at desc);
create index if not exists sales_transactions_seller_idx
on public.sales_transactions(seller_id,created_at desc);
create index if not exists sales_transactions_original_idx
on public.sales_transactions(original_sale_id)
where original_sale_id is not null;

create table if not exists public.sales_registers(
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  opening_cash_cents integer not null default 0,
  opened_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(event_id,workplace_id),
  check(opening_cash_cents between 0 and 100000000)
);

create or replace function upt_private.sales_can_transact(
  p_event uuid,
  p_workplace uuid,
  p_uid uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path='pg_catalog','public'
as $fn$
  select coalesce(
    p_uid is not null
    and exists(
      select 1 from public.profiles p
      where p.id=p_uid and p.approved=true and coalesce(p.account_blocked,false)=false
    )
    and (
      public.upt_is_admin(p_uid)
      or exists(
        select 1 from public.responsible_assignments r
        where r.event_id=p_event and r.workplace_id=p_workplace and r.user_id=p_uid
      )
      or exists(
        select 1 from public.shifts s
        where s.event_id=p_event and s.workplace_id=p_workplace and s.user_id=p_uid
          and s.status<>'cancelled'
          and coalesce(s.response_status,'')<>'declined'
      )
    ),
    false
  )
$fn$;

revoke all on function upt_private.sales_can_transact(uuid,uuid,uuid) from public,anon;
grant execute on function upt_private.sales_can_transact(uuid,uuid,uuid) to authenticated;

alter table public.sales_transactions enable row level security;
alter table public.sales_registers enable row level security;

revoke all on public.sales_transactions,public.sales_registers from anon;
revoke insert,update,delete on public.sales_transactions,public.sales_registers from authenticated;
grant select on public.sales_transactions,public.sales_registers to authenticated;

drop policy if exists sales_transactions_read on public.sales_transactions;
create policy sales_transactions_read
on public.sales_transactions
for select to authenticated
using(
  public.upt_is_admin((select auth.uid()))
  or seller_id=(select auth.uid())
  or upt_private.sales_can_transact(event_id,workplace_id,(select auth.uid()))
);

drop policy if exists sales_registers_admin_read on public.sales_registers;
create policy sales_registers_admin_read
on public.sales_registers
for select to authenticated
using(public.upt_is_admin((select auth.uid())));

create or replace function public.upt_sales_configure_item(
  p_item uuid,
  p_enabled boolean,
  p_category text default null,
  p_price_cents integer default null
) returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan verkoopartikelen instellen.';
  end if;
  if coalesce(p_enabled,false) and (p_category not in('merch','token') or p_price_cents is null or p_price_cents not between 0 and 10000000) then
    raise exception 'Kies Merch of Token en geef een geldige verkoopprijs.';
  end if;

  update public.inventory_items
  set sale_enabled=coalesce(p_enabled,false),
      sale_category=case when coalesce(p_enabled,false) then p_category else sale_category end,
      sale_price_cents=case when coalesce(p_enabled,false) then p_price_cents else sale_price_cents end,
      updated_at=now()
  where id=p_item and is_active=true;

  if not found then raise exception 'Inventarisitem niet gevonden.'; end if;
end
$fn$;

create or replace function public.upt_sales_set_opening_cash(
  p_event uuid,
  p_workplace uuid,
  p_opening_cash_cents integer
) returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan de begininhoud van de kassa instellen.';
  end if;
  if p_opening_cash_cents not between 0 and 100000000 then raise exception 'Ongeldig startbedrag.'; end if;
  if not exists(
    select 1 from public.workplaces w
    where w.id=p_workplace and w.event_id=p_event and w.is_active=true
  ) then raise exception 'Kies een geldige kassa of werkplek.'; end if;

  insert into public.sales_registers(event_id,workplace_id,opening_cash_cents,opened_by,opened_at,updated_at)
  values(p_event,p_workplace,p_opening_cash_cents,v_actor,now(),now())
  on conflict(event_id,workplace_id) do update
  set opening_cash_cents=excluded.opening_cash_cents,
      opened_by=v_actor,
      opened_at=now(),
      updated_at=now();
end
$fn$;

create or replace function public.upt_sales_record(
  p_item uuid,
  p_quantity integer,
  p_payment_method text
) returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_item public.inventory_items%rowtype;
  v_sale uuid;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_quantity not between 1 and 10000 then raise exception 'Ongeldig verkoopaantal.'; end if;
  if p_payment_method not in('cash','card') then raise exception 'Kies cash of kaart.'; end if;

  select * into v_item
  from public.inventory_items
  where id=p_item and is_active=true
  for update;

  if not found then raise exception 'Inventarisitem niet gevonden.'; end if;
  if not v_item.sale_enabled or v_item.sale_category not in('merch','token') or v_item.sale_price_cents is null then
    raise exception 'Dit inventarisitem is niet ingesteld voor verkoop.';
  end if;
  if not upt_private.sales_can_transact(v_item.event_id,v_item.workplace_id,v_actor) then
    raise exception 'Geen toegang om op deze werkplek te verkopen.';
  end if;
  if v_item.available_quantity<p_quantity then
    raise exception 'Onvoldoende voorraad voor deze verkoop.';
  end if;

  update public.inventory_items
  set available_quantity=available_quantity-p_quantity,
      total_quantity=total_quantity-p_quantity,
      updated_at=now()
  where id=v_item.id;

  insert into public.sales_transactions(
    event_id,workplace_id,inventory_item_id,seller_id,transaction_type,
    product_name,sale_category,quantity,unit_price_cents,payment_method
  ) values(
    v_item.event_id,v_item.workplace_id,v_item.id,v_actor,'sale',
    v_item.name,v_item.sale_category,p_quantity,v_item.sale_price_cents,p_payment_method
  ) returning id into v_sale;

  insert into public.inventory_movements(
    item_id,event_id,workplace_id,actor_id,movement_type,quantity,notes
  ) values(
    v_item.id,v_item.event_id,v_item.workplace_id,v_actor,'sold',p_quantity,
    'Verkoop · '||case when p_payment_method='cash' then 'cash' else 'kaart' end
  );

  return v_sale;
end
$fn$;

create or replace function public.upt_sales_refund(
  p_sale uuid,
  p_quantity integer,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_sale public.sales_transactions%rowtype;
  v_refunded integer;
  v_refund uuid;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan een verkoop terugboeken.';
  end if;
  if p_quantity not between 1 and 10000 then raise exception 'Ongeldig aantal voor terugboeking.'; end if;
  if length(coalesce(p_notes,''))>1000 then raise exception 'Notitie is te lang.'; end if;

  select * into v_sale
  from public.sales_transactions
  where id=p_sale and transaction_type='sale'
  for update;

  if not found then raise exception 'Verkoop niet gevonden.'; end if;

  select coalesce(sum(quantity),0)::integer into v_refunded
  from public.sales_transactions
  where original_sale_id=p_sale and transaction_type='refund';

  if v_refunded+p_quantity>v_sale.quantity then
    raise exception 'Er kan niet meer worden teruggeboekt dan oorspronkelijk verkocht.';
  end if;

  perform 1 from public.inventory_items where id=v_sale.inventory_item_id for update;

  update public.inventory_items
  set available_quantity=available_quantity+p_quantity,
      total_quantity=total_quantity+p_quantity,
      updated_at=now()
  where id=v_sale.inventory_item_id;

  insert into public.sales_transactions(
    event_id,workplace_id,inventory_item_id,seller_id,transaction_type,original_sale_id,
    product_name,sale_category,quantity,unit_price_cents,payment_method,notes
  ) values(
    v_sale.event_id,v_sale.workplace_id,v_sale.inventory_item_id,v_actor,'refund',v_sale.id,
    v_sale.product_name,v_sale.sale_category,p_quantity,v_sale.unit_price_cents,v_sale.payment_method,
    nullif(trim(coalesce(p_notes,'')),'')
  ) returning id into v_refund;

  insert into public.inventory_movements(
    item_id,event_id,workplace_id,actor_id,movement_type,quantity,notes
  ) values(
    v_sale.inventory_item_id,v_sale.event_id,v_sale.workplace_id,v_actor,'sale-refund',p_quantity,
    'Terugboeking verkoop'||case when nullif(trim(coalesce(p_notes,'')),'') is not null then ' · '||trim(p_notes) else '' end
  );

  return v_refund;
end
$fn$;

revoke all on function public.upt_sales_configure_item(uuid,boolean,text,integer),
                       public.upt_sales_set_opening_cash(uuid,uuid,integer),
                       public.upt_sales_record(uuid,integer,text),
                       public.upt_sales_refund(uuid,integer,text)
from public,anon;

grant execute on function public.upt_sales_configure_item(uuid,boolean,text,integer),
                          public.upt_sales_set_opening_cash(uuid,uuid,integer),
                          public.upt_sales_record(uuid,integer,text),
                          public.upt_sales_refund(uuid,integer,text)
to authenticated;

insert into public.role_ui_rules(role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings)
values
('admin','sales','Sales','navigation',true,true,'always',67,'{}'::jsonb),
('responsible_lead','sales','Verkoop','navigation',true,true,'assigned_workplace_role',67,'{}'::jsonb),
('staff','sales','Verkoop','navigation',true,true,'assigned_workplace_role',67,'{}'::jsonb)
on conflict(role,feature_key) do update set
  label=excluded.label,
  group_key=excluded.group_key,
  visible=excluded.visible,
  enabled=excluded.enabled,
  condition_key=excluded.condition_key,
  sort_order=excluded.sort_order,
  settings=excluded.settings;

notify pgrst,'reload schema';

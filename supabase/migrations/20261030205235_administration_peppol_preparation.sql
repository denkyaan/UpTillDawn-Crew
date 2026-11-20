-- Peppol preparation only: no provider dispatch, payment or issue-state changes.
create table public.admin_billing_profile (
 singleton boolean primary key default true check(singleton),
 name text not null default '',street_address text not null default '',postal_code text not null default '',city text not null default '',
 country_code text not null default 'BE',enterprise_number text not null default '',vat_number text not null default '',
 tax_registration text not null default '',peppol_endpoint text not null default '',iban text not null default '',
 approved_by uuid references auth.users(id),approved_at timestamptz,
 updated_by uuid references auth.users(id),updated_at timestamptz not null default now(),
 constraint admin_billing_approval_pair check((approved_by is null)=(approved_at is null)),
 constraint admin_billing_field_lengths check(length(name)<=200 and length(street_address)<=300 and length(postal_code)<=32 and length(city)<=120 and length(country_code)=2 and length(enterprise_number)<=50 and length(vat_number)<=50 and length(tax_registration)<=100 and length(peppol_endpoint)<=200 and length(iban)<=34)
);
create index admin_billing_profile_approved_by_idx on public.admin_billing_profile(approved_by);
create index admin_billing_profile_updated_by_idx on public.admin_billing_profile(updated_by);
alter table public.admin_billing_profile enable row level security;
revoke all on public.admin_billing_profile from public,anon,authenticated;
grant select,insert,update on public.admin_billing_profile to authenticated;
create policy admin_billing_profile_read on public.admin_billing_profile for select to authenticated using((select public.upt_can_manage_administration()));
create policy admin_billing_profile_insert on public.admin_billing_profile for insert to authenticated with check((select public.upt_can_manage_administration()));
create policy admin_billing_profile_update on public.admin_billing_profile for update to authenticated using((select public.upt_can_manage_administration())) with check((select public.upt_can_manage_administration()));

create function upt_administration_private.guard_billing_profile() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then raise exception 'Administration required' using errcode='42501';end if;
 if tg_op='INSERT' then
  if new.approved_by is not null or new.approved_at is not null then raise exception 'Save company data before approval';end if;
 elsif (to_jsonb(new)-array['approved_by','approved_at','updated_by','updated_at']) is distinct from (to_jsonb(old)-array['approved_by','approved_at','updated_by','updated_at']) then
  new.approved_by:=null;new.approved_at:=null;
 elsif new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at then
  if new.approved_by is not null or new.approved_at is not null then
   if not public.upt_is_admin() or new.approved_by is distinct from auth.uid() or new.approved_at is null then raise exception 'Admin company approval required' using errcode='42501';end if;
   new.approved_at:=now();
  end if;
 end if;
 new.updated_by:=auth.uid();new.updated_at:=now();return new;
end $$;
revoke all on function upt_administration_private.guard_billing_profile() from public,anon,authenticated;
create trigger admin_billing_profile_guard before insert or update on public.admin_billing_profile for each row execute function upt_administration_private.guard_billing_profile();

create table public.admin_billing_profile_audit(id bigint generated always as identity primary key,actor_id uuid references auth.users(id),old_record jsonb,new_record jsonb,created_at timestamptz not null default now());
create index admin_billing_profile_audit_actor_idx on public.admin_billing_profile_audit(actor_id);
alter table public.admin_billing_profile_audit enable row level security;
revoke all on public.admin_billing_profile_audit from public,anon,authenticated;
grant select on public.admin_billing_profile_audit to authenticated;
create policy admin_billing_profile_audit_read on public.admin_billing_profile_audit for select to authenticated using((select public.upt_can_manage_administration()));
create function upt_administration_private.audit_billing_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 insert into public.admin_billing_profile_audit(actor_id,old_record,new_record)values(auth.uid(),case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new));return new;
end $$;
revoke all on function upt_administration_private.audit_billing_profile() from public,anon,authenticated;
create trigger admin_billing_profile_audit after insert or update on public.admin_billing_profile for each row execute function upt_administration_private.audit_billing_profile();

alter table public.admin_financial_documents add column buyer_reference text,add column order_reference text,add column delivery_date date,add column delivery_country text,
 add constraint admin_peppol_reference_lengths check((buyer_reference is null or length(buyer_reference)<=200)and(order_reference is null or length(order_reference)<=200)),
 add constraint admin_peppol_delivery_country check(delivery_country is null or delivery_country~'^[A-Z]{2}$');
alter table public.admin_financial_lines add column unit_code text not null default 'C62',add column vat_category text,add column vat_exemption_reason text,
 add constraint admin_peppol_unit check(unit_code~'^[A-Z0-9]{1,3}$'),
 add constraint admin_peppol_vat_category check(vat_category is null or vat_category in('S','Z','E','AE','K','G','O')),
 add constraint admin_peppol_vat_rate check(vat_category is null or(vat_category='S'and vat_rate>0)or(vat_category<>'S'and vat_rate=0)),
 add constraint admin_peppol_exemption_length check(vat_exemption_reason is null or length(vat_exemption_reason)<=500);

-- Existing approval, line mutation and audit guards remain authoritative.
create function upt_administration_private.guard_peppol_metadata() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and old.status<>'draft' and row(new.buyer_reference,new.order_reference,new.delivery_date,new.delivery_country) is distinct from row(old.buyer_reference,old.order_reference,old.delivery_date,old.delivery_country) and not public.upt_is_admin() then
  raise exception 'Admin is required to enrich an approved document' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function upt_administration_private.guard_peppol_metadata() from public,anon,authenticated;
create trigger admin_peppol_metadata_guard before update on public.admin_financial_documents for each row execute function upt_administration_private.guard_peppol_metadata();

-- EN16931 totals sum rounded line net amounts and rounded VAT-category totals.
-- Only drafts whose lines are actually edited are recalculated. Historical
-- approved figures are never rewritten; incompatible exports are rejected.
create or replace function public.upt_admin_recalculate_financial_lines() returns trigger language plpgsql security definer set search_path='' as $$
declare target_id uuid:=coalesce(new.document_id,old.document_id);calculated_net numeric;calculated_tax numeric;
begin
 with grouped as(select coalesce(vat_category,case when vat_rate>0 then 'S' else 'Z' end) category,vat_rate,sum(round(quantity*unit_price,2)) net
 from public.admin_financial_lines where document_id=target_id group by 1,2)
 select coalesce(sum(net),0),coalesce(sum(round(net*vat_rate/100,2)),0)into calculated_net,calculated_tax from grouped;
 update public.admin_financial_documents set net_amount=calculated_net,tax_amount=calculated_tax,updated_at=now()where id=target_id and status='draft';
 if not found then raise exception 'Invoice lines can only change while draft';end if;
 return coalesce(new,old);
end $$;
revoke all on function public.upt_admin_recalculate_financial_lines() from public,anon,authenticated;

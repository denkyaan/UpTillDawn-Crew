-- Atomic, replay-safe bulk inventory reception from approved purchase invoices.
-- Never increase stock automatically from an unapproved invoice or an upload.
create table if not exists upt_administration_private.inventory_receipt_batches (
 request_id uuid primary key,
 document_id uuid not null references public.admin_financial_documents(id) on delete restrict,
 payload_hash text not null check(length(payload_hash)=32),
 receipt_count integer not null check(receipt_count between 1 and 50),
 received_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table upt_administration_private.inventory_receipt_batches enable row level security;
revoke all on upt_administration_private.inventory_receipt_batches from public,anon,authenticated;

create or replace function upt_administration_private.receive_inventory_batch(
 p_request uuid,p_document uuid,p_rows jsonb
) returns integer
language plpgsql security definer set search_path=''
as $$
declare
 v_row jsonb;
 v_line uuid;
 v_item uuid;
 v_quantity integer;
 v_count integer:=0;
 v_seen uuid[]:=array[]::uuid[];
 v_hash text;
 v_prior upt_administration_private.inventory_receipt_batches%rowtype;
 v_inserted boolean;
 v_line_text text;
 v_item_text text;
 v_quantity_text text;
begin
 if auth.uid() is null
    or not public.upt_can_manage_administration()
    or not public.upt_is_admin() then
  raise exception 'Admin required' using errcode='42501';
 end if;
 if p_request is null or p_document is null or p_rows is null
    or jsonb_typeof(p_rows)<>'array' then
  raise exception 'Invalid inventory batch' using errcode='22023';
 end if;
 if jsonb_array_length(p_rows) not between 1 and 50 then
  raise exception 'Inventory batch requires 1-50 lines' using errcode='22023';
 end if;
 v_hash:=md5(p_document::text||':'||p_rows::text);
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into v_prior from upt_administration_private.inventory_receipt_batches
 where request_id=p_request for update;
 if found then
  if v_prior.document_id<>p_document or v_prior.payload_hash<>v_hash then
   raise exception 'Inventory batch replay conflict' using errcode='23505';
  end if;
  return v_prior.receipt_count;
 end if;

 for v_row in
  select x.elem from jsonb_array_elements(p_rows) as x(elem)
  order by x.elem->>'line',x.elem->>'item'
 loop
  if jsonb_typeof(v_row)<>'object'
     or jsonb_typeof(v_row->'quantity')<>'number' then
   raise exception 'Invalid inventory line payload' using errcode='22023';
  end if;
  v_line_text:=v_row->>'line';
  v_item_text:=v_row->>'item';
  v_quantity_text:=v_row->>'quantity';
  if v_line_text is null or v_line_text !~
    '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
   or v_item_text is null or v_item_text !~
    '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
   or v_quantity_text is null or v_quantity_text !~ '^[0-9]{1,6}$' then
   raise exception 'Invalid inventory batch values' using errcode='22023';
  end if;
  v_line:=v_line_text::uuid;
  v_item:=v_item_text::uuid;
  v_quantity:=v_quantity_text::integer;
  if v_quantity not between 1 and 100000
     or v_line=any(v_seen) then
   raise exception 'Quantity or duplicate purchase line invalid' using errcode='22023';
  end if;
  v_seen:=array_append(v_seen,v_line);
  if not exists (
   select 1 from public.admin_financial_lines
   where id=v_line and document_id=p_document
  ) then
   raise exception 'Purchase line is not part of the selected invoice'
    using errcode='22023';
  end if;
  -- The existing row-locked, Admin-only receipt RPC validates invoice approval,
  -- event scope, purchased quantity, stock state, inventory movement and audit.
  -- This entire function is one transaction: any line error rolls back ALL
  -- previous stock movements, receipts and audit records from this batch.
  select public.upt_receive_invoice_inventory(
   md5(p_request::text||':'||v_line::text||':'||v_item::text)::uuid,
   v_line,v_item,v_quantity
  ) into v_inserted;
  if v_inserted is distinct from true then
   raise exception 'Inventory receipt already posted independently'
    using errcode='23505';
  end if;
  v_count:=v_count+1;
 end loop;

 insert into upt_administration_private.inventory_receipt_batches(
  request_id,document_id,payload_hash,receipt_count,received_by
 ) values(p_request,p_document,v_hash,v_count,auth.uid());
 return v_count;
end;
$$;
revoke all on function upt_administration_private.receive_inventory_batch(uuid,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function upt_administration_private.receive_inventory_batch(uuid,uuid,jsonb)
 to authenticated;

create or replace function public.upt_admin_receive_inventory_batch(
 p_request uuid,p_document uuid,p_rows jsonb
) returns integer language sql set search_path='' as $$
 select upt_administration_private.receive_inventory_batch(p_request,p_document,p_rows);
$$;
revoke all on function public.upt_admin_receive_inventory_batch(uuid,uuid,jsonb)
 from public,anon;
grant execute on function public.upt_admin_receive_inventory_batch(uuid,uuid,jsonb)
 to authenticated;
comment on function public.upt_admin_receive_inventory_batch(uuid,uuid,jsonb)
 is 'Admin-only atomic receipt of 1-50 approved purchase-invoice lines with exact replay protection.';

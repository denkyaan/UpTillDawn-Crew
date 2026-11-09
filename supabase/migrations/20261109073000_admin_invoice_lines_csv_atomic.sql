-- Bulk import normalized invoice lines with mandatory review and atomic idempotent SQL.
-- No payment, inventory movement, account approval or external provider call occurs here.
create table if not exists public.admin_financial_line_imports(
 id uuid primary key,
 document_id uuid not null references public.admin_financial_documents(id) on delete restrict,
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 source_name text not null check(length(source_name) between 1 and 200),
 row_count integer not null check(row_count between 1 and 100),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(document_id,source_sha256)
);
create index if not exists admin_financial_line_imports_document_idx
 on public.admin_financial_line_imports(document_id,created_at desc);
create index if not exists admin_financial_line_imports_actor_idx
 on public.admin_financial_line_imports(created_by);
alter table public.admin_financial_line_imports enable row level security;
revoke all on public.admin_financial_line_imports from public,anon,authenticated;
grant select on public.admin_financial_line_imports to authenticated;
drop policy if exists admin_financial_line_imports_read on public.admin_financial_line_imports;
create policy admin_financial_line_imports_read on public.admin_financial_line_imports
 for select to authenticated using(public.upt_can_manage_administration());

create or replace function public.upt_admin_import_invoice_lines_csv(
 p_request uuid,p_document uuid,p_sha256 text,p_source_name text,p_rows jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_document public.admin_financial_documents%rowtype;
 v_previous public.admin_financial_line_imports%rowtype;
 v_row jsonb;
 v_description text;
 v_quantity_text text;
 v_price_text text;
 v_vat_text text;
 v_quantity numeric;
 v_price numeric;
 v_vat numeric;
 v_count integer := 0;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration permission required' using errcode='42501';
 end if;
 if p_request is null or p_document is null or p_sha256 !~ '^[a-f0-9]{64}$'
   or p_source_name is null or length(p_source_name) not between 1 and 200
   or p_source_name ~ '[[:cntrl:]]'
   or p_rows is null or jsonb_typeof(p_rows)<>'array'
   or jsonb_array_length(p_rows) not between 1 and 100 then
  raise exception 'Invalid invoice CSV import' using errcode='22023';
 end if;
 select * into v_document from public.admin_financial_documents
  where id=p_document for update;
 if not found or v_document.status<>'draft'
  or v_document.kind not in ('purchase_invoice','sales_invoice')
  or v_document.currency<>'EUR' then
  raise exception 'Only EUR invoice drafts accept line imports' using errcode='22023';
 end if;
 select * into v_previous from public.admin_financial_line_imports where id=p_request;
 if found then
  if v_previous.document_id=p_document and v_previous.source_sha256=p_sha256
    and v_previous.source_name=p_source_name
    and v_previous.row_count=jsonb_array_length(p_rows) then
   return jsonb_build_object('inserted',0,'skipped',v_previous.row_count,'documentId',p_document);
  end if;
  raise exception 'Import request ID was already used differently' using errcode='23505';
 end if;
 select * into v_previous from public.admin_financial_line_imports
  where document_id=p_document and source_sha256=p_sha256;
 if found then
  return jsonb_build_object('inserted',0,'skipped',v_previous.row_count,'documentId',p_document);
 end if;
 -- A marker and all invoice lines are committed together, or rolled back together.
 insert into public.admin_financial_line_imports(id,document_id,source_sha256,source_name,row_count,created_by)
 values(p_request,p_document,p_sha256,p_source_name,jsonb_array_length(p_rows),auth.uid());
 for v_row in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(v_row)<>'object'
    or jsonb_typeof(v_row->'description')<>'string'
    or jsonb_typeof(v_row->'quantity')<>'string'
    or jsonb_typeof(v_row->'unitPrice')<>'string'
    or jsonb_typeof(v_row->'vatRate')<>'string' then
   raise exception 'Invalid invoice line structure' using errcode='22023';
  end if;
  v_description:=trim(v_row->>'description');
  v_quantity_text:=v_row->>'quantity';
  v_price_text:=v_row->>'unitPrice';
  v_vat_text:=v_row->>'vatRate';
  if length(v_description) not between 1 and 500
    or v_description ~ '[[:cntrl:]]' or v_description ~ '^[=+@-]'
    or v_quantity_text !~ '^(?:0|[1-9][0-9]{0,5})(?:[.][0-9]{1,3})?$'
    or v_price_text !~ '^(?:0|[1-9][0-9]{0,6})(?:[.][0-9]{1,4})?$'
    or v_vat_text !~ '^(?:0|[1-9][0-9]{0,2})(?:[.][0-9]{1,2})?$' then
   raise exception 'Invalid invoice line values' using errcode='22023';
  end if;
  v_quantity:=v_quantity_text::numeric;
  v_price:=v_price_text::numeric;
  v_vat:=v_vat_text::numeric;
  if v_quantity<=0 or v_quantity>100000 or v_price<0 or v_price>9999999
    or v_vat<0 or v_vat>100 then
   raise exception 'Invoice line outside allowed range' using errcode='22023';
  end if;
  insert into public.admin_financial_lines(document_id,description,quantity,unit_price,vat_rate)
   values(p_document,v_description,v_quantity,v_price,v_vat);
  v_count:=v_count+1;
 end loop;
 return jsonb_build_object('inserted',v_count,'skipped',0,'documentId',p_document);
end;
$$;
revoke all on function public.upt_admin_import_invoice_lines_csv(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.upt_admin_import_invoice_lines_csv(uuid,uuid,text,text,jsonb) to authenticated;

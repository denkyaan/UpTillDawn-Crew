-- Avoid ambiguous financial document identifiers within the same document type.
-- Existing duplicate numbers are reported, not silently renumbered.
create or replace function public.upt_admin_guard_financial_document_number()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if new.document_number is not null then
  new.document_number=nullif(btrim(new.document_number),'');
 end if;
 if new.document_number is not null then
  perform pg_advisory_xact_lock(hashtextextended(new.kind||':'||lower(new.document_number),0));
  if exists (
   select 1 from public.admin_financial_documents d
   where d.kind=new.kind and lower(btrim(d.document_number))=lower(new.document_number)
    and d.id is distinct from new.id
  ) and (tg_op='INSERT' or new.document_number is distinct from old.document_number or new.kind is distinct from old.kind) then
   raise exception 'Duplicate financial document number for this document type';
  end if;
 end if;
 if new.status in ('review','approved','issued','paid') and new.kind in ('sales_invoice','purchase_invoice','credit_note')
   and new.document_number is null then
  raise exception 'Financial document number is required before review';
 end if;
 return new;
end;
$$;
drop trigger if exists upt_admin_document_number_guard on public.admin_financial_documents;
create trigger upt_admin_document_number_guard before insert or update on public.admin_financial_documents
 for each row execute function public.upt_admin_guard_financial_document_number();
revoke execute on function public.upt_admin_guard_financial_document_number() from public,anon,authenticated;

-- Use a conditional unique index so historical duplicate records remain visible
-- for manual reconciliation instead of blocking the entire migration.
do $$
begin
 if not exists (
  select 1 from public.admin_financial_documents
  where document_number is not null and btrim(document_number)<>''
  group by kind, lower(btrim(document_number))
  having count(*)>1
 ) then
  create unique index if not exists admin_financial_documents_unique_kind_number
   on public.admin_financial_documents(kind,lower(btrim(document_number)))
   where document_number is not null;
 else
  raise notice 'Existing duplicate financial document numbers require reconciliation before the unique index can be created';
 end if;
end;
$$;

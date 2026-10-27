-- Block incomplete invoice drafts from entering review.
-- Existing documents in review or later stages remain unchanged.
create or replace function public.upt_admin_require_invoice_review_fields()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if new.kind in ('sales_invoice','purchase_invoice') and new.status='review'
  and (tg_op='INSERT' or old.status is distinct from new.status) then
  if new.counterparty_id is null then
   raise exception 'Invoice requires a customer or supplier before review';
  end if;
  if new.document_number is null or btrim(new.document_number)='' then
   raise exception 'Invoice requires a document number before review';
  end if;
  if new.issue_date is null or new.due_date is null then
   raise exception 'Invoice requires issue and due dates before review';
  end if;
  if new.gross_amount<=0 then
   raise exception 'Invoice amount must be positive before review';
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists upt_admin_invoice_review_fields on public.admin_financial_documents;
create trigger upt_admin_invoice_review_fields before insert or update on public.admin_financial_documents
 for each row execute function public.upt_admin_require_invoice_review_fields();
revoke execute on function public.upt_admin_require_invoice_review_fields() from public,anon,authenticated;

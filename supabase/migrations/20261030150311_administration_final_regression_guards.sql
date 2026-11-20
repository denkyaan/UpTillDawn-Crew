-- Repair SQL regex escaping in legacy archive policies and guards.
-- Prevent direct updates that change contract identity, envelope ownership,
-- or illegally advance terminal signing states. This guard runs even when
-- a future policy grants additional UPDATE permissions.
create or replace function public.upt_guard_contract_signing_update()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.id is distinct from old.id
 or new.document_type is distinct from old.document_type
 or new.document_id is distinct from old.document_id
 or new.document_version is distinct from old.document_version
 or new.document_sha256 is distinct from old.document_sha256
 or new.recipient_email is distinct from old.recipient_email
 or new.created_at is distinct from old.created_at then
  raise exception 'Signing contract identity is immutable';
 end if;
 if old.envelope_id is not null and new.envelope_id is distinct from old.envelope_id then
  raise exception 'Signing envelope identity is immutable';
 end if;
 if old.envelope_id is null and new.envelope_id is not null and old.status <> 'draft' then
  raise exception 'Envelope attachment requires draft state';
 end if;
 if new.status is distinct from old.status and not (
  (old.status='draft' and new.status in ('sent','completed','rejected','cancelled'))
  or (old.status='sent' and new.status in ('completed','rejected','cancelled'))
 ) then
  raise exception 'Invalid signing state transition';
 end if;
 if new.status <> 'draft' and new.envelope_id is null then
  raise exception 'Signing envelope required';
 end if;
 if old.completed_at is not null and new.completed_at is distinct from old.completed_at then
  raise exception 'Completion timestamp is immutable';
 end if;
 if new.status='completed' and new.completed_at is null then
  raise exception 'Completed signing requires timestamp';
 end if;
 if new.signed_pdf_path is distinct from old.signed_pdf_path and (
  old.signed_pdf_path is not null or new.status <> 'completed'
  or new.signed_pdf_path !~ ('^' || new.document_type || '/' ||
   new.document_id::text || '/v' || new.document_version::text ||
   '/signed-[a-f0-9]{64}\.pdf$')
 ) then
  raise exception 'Invalid signed archive path';
 end if;
 new.updated_at=now();
 return new;
end;
$$;

revoke all on function public.upt_guard_contract_signing_update() from public,anon,authenticated;
alter policy administration_contract_archive_artist_read on storage.objects
using (
 bucket_id = 'administration-contracts'
 and public.upt_can_manage_administration()
 and (storage.foldername(name))[1] = 'artist'
 and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and (storage.foldername(name))[3] ~ '^v[1-9][0-9]*$'
 and name ~ '^artist/[0-9a-fA-F-]{36}/v[1-9][0-9]*/(draft|signed)-[a-f0-9]{64}\.pdf$'
 and exists (
  select 1 from public.admin_artist_agreement_versions v
  where v.id::text = (storage.foldername(name))[2]
    and ('v' || v.version_number::text) = (storage.foldername(name))[3]
    and v.approved_at is not null
 )
);

-- Complete MVCC snapshots; approved credits are settlement, not a second open invoice.
create or replace function public.upt_administration_finance_summary()
returns jsonb language sql stable security invoker set search_path='' as $$
 with p as(select document_id,sum(amount)*100 paid from public.admin_financial_payments group by document_id),
 c as(select original_invoice_id,sum(gross_amount)*100 credited from public.admin_financial_documents where kind='credit_note' and status in ('approved','issued','paid') group by original_invoice_id),
 invoices as(select d.id,d.due_date,d.gross_amount*100 gross,coalesce(p.paid,0) paid,coalesce(c.credited,0) credited
 from public.admin_financial_documents d left join p on p.document_id=d.id left join c on c.original_invoice_id=d.id
 where d.kind in ('sales_invoice','purchase_invoice') and d.status in ('approved','issued','paid') and d.currency='EUR'),
 balances as(select *,greatest(0,gross-paid-credited) outstanding,(now() at time zone 'Europe/Brussels')::date-due_date overdue_days from invoices)
 select jsonb_build_object('invoices',count(*)::text,
 'documents',(select count(*)::text from public.admin_financial_documents),
 'drafts',(select count(*)::text from public.admin_financial_documents where status='draft'),
 'unpaid',(count(*) filter(where paid+credited=0 and gross>0))::text,
 'partial',(count(*) filter(where paid+credited>0 and paid+credited<gross))::text,
 'settled',(count(*) filter(where paid+credited=gross))::text,
 'overpaid',(count(*) filter(where paid+credited>gross))::text,
 'paid_cents',coalesce(sum(paid),0)::bigint::text,
 'outstanding_cents',coalesce(sum(outstanding),0)::bigint::text,
 'overdue_cents',coalesce(sum(outstanding) filter(where overdue_days>0),0)::bigint::text,
 'overdue_1_30',(count(*) filter(where outstanding>0 and overdue_days between 1 and 30))::text,
 'overdue_31_60',(count(*) filter(where outstanding>0 and overdue_days between 31 and 60))::text,
 'overdue_61_plus',(count(*) filter(where outstanding>0 and overdue_days>=61))::text) from balances;
$$;
create function public.upt_administration_document_balances(p_ids uuid[])
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_rows jsonb;
begin
 if cardinality(p_ids)>500 then raise exception 'Too many document IDs';end if;
 with p as(select document_id,sum(amount)*100 paid from public.admin_financial_payments where document_id=any(p_ids) group by document_id),
 c as(select original_invoice_id,sum(gross_amount)*100 credited from public.admin_financial_documents where original_invoice_id=any(p_ids) and kind='credit_note' and status in ('approved','issued','paid') group by original_invoice_id)
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'paid_cents',coalesce(p.paid,0)::bigint::text,'credited_cents',coalesce(c.credited,0)::bigint::text,
 'outstanding_cents',greatest(0,d.gross_amount*100-coalesce(p.paid,0)-coalesce(c.credited,0))::bigint::text)),'[]'::jsonb) into v_rows
 from public.admin_financial_documents d left join p on p.document_id=d.id left join c on c.original_invoice_id=d.id where d.id=any(p_ids);
 return v_rows;
end $$;
revoke all on function public.upt_administration_document_balances(uuid[]) from public,anon;
grant execute on function public.upt_administration_document_balances(uuid[]) to authenticated;
notify pgrst,'reload schema';

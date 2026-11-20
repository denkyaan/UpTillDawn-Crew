-- Remove the dedicated staging QA namespace after verified integration runs.
-- No generated row IDs are assumed. Clean databases and production have no
-- matching reserved .invalid accounts and return without changing anything.
do $qa_cleanup$
declare
 v_namespace text:='f6fe51db22';
 v_users uuid[];v_docs uuid[];v_items uuid[];v_bookings uuid[];v_cases uuid[];v_parties uuid[];v_event uuid;
begin
 select coalesce(array_agg(id),'{}'::uuid[]) into v_users from auth.users
 where email like 'qa-'||v_namespace||'-%@qa.uptilldawn.invalid';
 if cardinality(v_users)=0 then return;end if;
 if cardinality(v_users)<>6 then raise exception 'QA namespace identity mismatch';end if;
 if exists(select 1 from upt_private.app_owners where user_id=any(v_users)) then raise exception 'Permanent owners cannot be cleaned';end if;
 select id into strict v_event from public.events where name='QA Full application '||v_namespace and created_by=any(v_users);
 if exists(select 1 from public.admin_financial_documents where created_by=any(v_users) and document_number not like 'QA-%') then raise exception 'Unexpected non-QA financial record';end if;
 select coalesce(array_agg(id),'{}'::uuid[]) into v_docs from public.admin_financial_documents where created_by=any(v_users);
 select coalesce(array_agg(id),'{}'::uuid[]) into v_items from public.inventory_items where event_id=v_event;
 select coalesce(array_agg(id),'{}'::uuid[]) into v_bookings from public.admin_artist_bookings where created_by=any(v_users);
 select coalesce(array_agg(id),'{}'::uuid[]) into v_cases from public.admin_operational_obligations where created_by=any(v_users);
 select coalesce(array_agg(distinct counterparty_id) filter(where counterparty_id is not null),'{}'::uuid[]) into v_parties from public.admin_financial_documents where id=any(v_docs);
 if exists(select 1 from public.admin_financial_payments where document_id=any(v_docs) and not(created_by=any(v_users))) then raise exception 'QA invoice has a non-QA payment';end if;
 if exists(select 1 from public.admin_financial_documents where original_invoice_id=any(v_docs) and not(id=any(v_docs))) then raise exception 'QA invoice has a non-QA credit';end if;
 if exists(select 1 from public.inventory_movements where item_id=any(v_items) and not(actor_id=any(v_users))) then raise exception 'QA stock has a non-QA movement';end if;
 if exists(select 1 from public.portal_role_assignments where approved_by=any(v_users) and not(user_id=any(v_users))) then raise exception 'QA approver has a non-QA assignment';end if;
 if exists(select 1 from pg_trigger where tgrelid in('public.admin_financial_documents'::regclass,'public.admin_financial_lines'::regclass,'public.admin_financial_payments'::regclass) and not tgisinternal and tgenabled<>'O') then raise exception 'Unexpected financial trigger state';end if;
 -- Table-owner maintenance, preserving all FK/constraint triggers. These
 -- table locks and trigger states are transactional; any failure rolls back.
 lock table public.admin_financial_documents,public.admin_financial_lines,public.admin_financial_payments in access exclusive mode nowait;
 alter table public.admin_financial_documents disable trigger user;
 alter table public.admin_financial_lines disable trigger user;
 alter table public.admin_financial_payments disable trigger user;
 delete from public.admin_inventory_receipts where line_id in(select id from public.admin_financial_lines where document_id=any(v_docs)) or item_id=any(v_items);
 delete from public.admin_financial_payments where document_id=any(v_docs);
 delete from public.admin_payment_reminders where document_id=any(v_docs);
 delete from public.admin_financial_attachments where document_id=any(v_docs);
 delete from public.admin_financial_lines where document_id=any(v_docs);
 delete from public.admin_financial_audit where document_id=any(v_docs);
 delete from public.admin_financial_documents where id=any(v_docs);
 alter table public.admin_financial_documents enable trigger user;
 alter table public.admin_financial_lines enable trigger user;
 alter table public.admin_financial_payments enable trigger user;
 delete from public.admin_obligation_notifications where obligation_id=any(v_cases);
 delete from public.admin_operational_obligations where id=any(v_cases);
 delete from public.administration_contract_signing_requests where document_type='artist' and document_id in(select id from public.admin_artist_agreement_versions where booking_id=any(v_bookings));
 delete from public.admin_artist_agreement_signature_requests where agreement_version_id in(select id from public.admin_artist_agreement_versions where booking_id=any(v_bookings));
 delete from public.admin_artist_agreement_versions where booking_id=any(v_bookings);
 delete from public.admin_artist_booking_communications where booking_id=any(v_bookings);
 delete from public.admin_artist_booking_note_audit where booking_id=any(v_bookings);
 delete from public.admin_artist_bookings where id=any(v_bookings);
 delete from public.inventory_movements where item_id=any(v_items);
 delete from public.inventory_items where id=any(v_items);
 delete from public.admin_ticket_sales where event_id=v_event;
 delete from public.admin_ticket_imports where event_id=v_event;
 delete from public.admin_counterparties where id=any(v_parties) and not exists(select 1 from public.admin_financial_documents d where d.counterparty_id=admin_counterparties.id);
 delete from public.crew_notifications where body like '%'||v_namespace||'%' or link like '%'||v_event::text||'%';
 delete from public.portal_role_assignments where user_id=any(v_users);
 delete from public.events where id=v_event;
 delete from auth.refresh_tokens where user_id=any(v_users::text[]);
 delete from auth.users where id=any(v_users);
end $qa_cleanup$;

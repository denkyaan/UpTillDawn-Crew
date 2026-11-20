\if :{?TEST_ADMIN_ID}
\set ON_ERROR_STOP on
begin;
select set_config('upt.test.admin', :'TEST_ADMIN_ID', true);
select set_config('upt.test.office', :'TEST_OFFICE_ID', true);
select set_config('upt.test.staff', :'TEST_STAFF_ID', true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('upt.test.office'),true);
do $test$
declare denied boolean:=false;rows_changed integer;party uuid;document uuid;actor uuid:=current_setting('upt.test.admin')::uuid;net numeric;tax numeric;
begin
 insert into public.admin_billing_profile(singleton,name,street_address,postal_code,city,country_code,enterprise_number,vat_number,peppol_endpoint)
 values(true,'Fictional QA company','Example 1','1000','Brussels','BE','0000000196','BE0000000196','0208:0000000196');
 begin update public.admin_billing_profile set approved_by=auth.uid(),approved_at=now();exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Office approved company data';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 update public.admin_billing_profile set approved_by=actor,approved_at=now();
 if not exists(select 1 from public.admin_billing_profile where approved_by=actor)then raise exception 'Admin company approval failed';end if;
 perform set_config('request.jwt.claim.sub',current_setting('upt.test.office'),true);
 update public.admin_billing_profile set name='Fictional QA company changed';
 if exists(select 1 from public.admin_billing_profile where approved_by is not null or approved_at is not null)then raise exception 'Company edit retained approval';end if;
 if(select count(*)from public.admin_billing_profile_audit)<3 then raise exception 'Company changes are not audited';end if;
 denied:=false;begin insert into public.admin_billing_profile_audit(actor_id)values(auth.uid());exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Office forged company audit';end if;
 insert into public.admin_counterparties(name,kind)values('Rolled-back Peppol customer','customer')returning id into party;
 insert into public.admin_financial_documents(kind,document_number,counterparty_id,issue_date,due_date,buyer_reference)
 values('sales_invoice','QA-PEPPOL-'||gen_random_uuid(),party,current_date,current_date+14,'TEST')returning id into document;
 insert into public.admin_financial_lines(document_id,description,quantity,unit_price,vat_rate,vat_category)values(document,'Rounding line 1',1,0.005,21,'S'),(document,'Rounding line 2',1,0.005,21,'S');
 select net_amount,tax_amount into net,tax from public.admin_financial_documents where id=document;
 if net<>0.02 or tax<>0 then raise exception 'Line net rounding incorrect: % %',net,tax;end if;
 update public.admin_financial_lines set unit_price=0.03 where document_id=document;
 select net_amount,tax_amount into net,tax from public.admin_financial_documents where id=document;
 if net<>0.06 or tax<>0.01 then raise exception 'VAT category rounding incorrect: % %',net,tax;end if;
 update public.admin_financial_documents set status='review'where id=document;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 update public.admin_financial_documents set status='approved',approved_by=actor,approved_at=now()where id=document;
 perform set_config('request.jwt.claim.sub',current_setting('upt.test.office'),true);
 begin
  update public.admin_financial_documents set buyer_reference='FORGED'where id=document;
  get diagnostics rows_changed=row_count;
  if rows_changed<>0 then raise exception 'Office edited approved Peppol references';end if;
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 update public.admin_financial_documents set buyer_reference='ADMIN-ENRICHED'where id=document;
 if not exists(select 1 from public.admin_financial_documents where id=document and buyer_reference='ADMIN-ENRICHED')then raise exception 'Admin enrichment failed';end if;
 perform set_config('request.jwt.claim.sub',current_setting('upt.test.staff'),true);
 if exists(select 1 from public.admin_billing_profile)or exists(select 1 from public.admin_billing_profile_audit)then raise exception 'Ordinary staff read company billing data';end if;
 raise notice 'PASS: company approval, invalidation, audit, staff denial, Peppol references and exact VAT rounding';
end $test$;
rollback;
\else
\echo SKIP: Peppol integration requires seeded role IDs
\endif

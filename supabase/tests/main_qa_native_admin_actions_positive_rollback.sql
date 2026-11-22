-- Main-QA-only positive 12-action SQL roundtrip with disposable rows.
-- Every row, audit, shift, payment and refund is rolled back in ONE transaction.
-- Never run on production. Does not enable HTTP mutation endpoints.
BEGIN;
SET LOCAL statement_timeout='25s';
SET LOCAL lock_timeout='3s';
DO $fixture$
DECLARE h uuid; s uuid; e uuid:=gen_random_uuid();w uuid:=gen_random_uuid();
 i uuid:=gen_random_uuid();sal uuid:=gen_random_uuid();a uuid:=gen_random_uuid();
 d uuid:=gen_random_uuid(); st timestamptz:=now()+interval '270 days';
 en timestamptz:=now()+interval '270 days 8 hours';
BEGIN
 IF (SELECT count(*) FROM auth.users WHERE email LIKE 'e2e-%@uptilldawn.test')<>7
 THEN RAISE EXCEPTION 'Only seven Main QA bots may be used'; END IF;
 SELECT id INTO STRICT h FROM auth.users WHERE email='e2e-head-admin@uptilldawn.test';
 SELECT id INTO STRICT s FROM auth.users WHERE email='e2e-staff@uptilldawn.test';
 INSERT INTO public.events(id,name,start_at,end_at,start_date,end_date,created_by)
 VALUES(e,'QA-ROLLBACK-ONLY',st,en,st,en,h);
 INSERT INTO public.workplaces(id,event_id,name,target_staff)VALUES(w,e,'QA temporary backstage',0);
 INSERT INTO public.inventory_items(id,event_id,workplace_id,name,total_quantity,available_quantity,created_by)
 VALUES(i,e,w,'QA temporary merch',10,10,h);
 INSERT INTO public.sales_transactions(id,event_id,workplace_id,inventory_item_id,
 product_name,sale_category,quantity,unit_price_cents,payment_method,seller_id)
 VALUES(sal,e,w,i,'QA temporary merch','merch',2,100,'cash',h);
 INSERT INTO public.planning_recommendations(id,event_id,workplace_id,recommended_user_id,
 created_by,scheduled_start,scheduled_end,role_name,status)
 VALUES(a,e,w,s,h,st,en,'Personeel','proposed');
 INSERT INTO public.planning_recommendations(id,event_id,workplace_id,recommended_user_id,
 created_by,scheduled_start,scheduled_end,role_name,status)
 VALUES(d,e,w,h,h,st,en,'Personeel','proposed');
 PERFORM set_config('qa.pos.head',h::text,true);
 PERFORM set_config('qa.pos.event',e::text,true);
 PERFORM set_config('qa.pos.workplace',w::text,true);
 PERFORM set_config('qa.pos.item',i::text,true);
 PERFORM set_config('qa.pos.sale',sal::text,true);
 PERFORM set_config('qa.pos.apply',a::text,true);
 PERFORM set_config('qa.pos.dismiss',d::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $positive$
DECLARE e uuid:=current_setting('qa.pos.event')::uuid;
 w uuid:=current_setting('qa.pos.workplace')::uuid;
 i uuid:=current_setting('qa.pos.item')::uuid;
 sal uuid:=current_setting('qa.pos.sale')::uuid;
 a uuid:=current_setting('qa.pos.apply')::uuid;
 d uuid:=current_setting('qa.pos.dismiss')::uuid;
 guest uuid; refund uuid; shift uuid; generated integer; report jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa.pos.head'),true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 IF NOT public.upt_is_approved() OR NOT public.upt_is_admin(auth.uid())
 THEN RAISE EXCEPTION 'QA head is not authorized'; END IF;
 guest:=public.upt_guestlist_add_entry(e,'QA artist','artist',2,'QA');
 IF guest IS NULL THEN RAISE EXCEPTION 'Guest add did not return ID'; END IF;
 PERFORM public.upt_guestlist_update_entry(guest,'QA updated artist','artist',3,'Updated');
 PERFORM public.upt_guestlist_set_artist_hospitality(guest,'Water','Vegan');
 PERFORM public.upt_guestlist_set_backstage_workplace(e,w);
 PERFORM public.upt_guestlist_remove_entry(guest);
 IF EXISTS(SELECT 1 FROM public.event_guestlist_entries WHERE id=guest AND is_active)
 THEN RAISE EXCEPTION 'Guest removal failed'; END IF;
 PERFORM public.upt_sales_configure_item(i,true,'merch',1345);
 PERFORM public.upt_sales_set_opening_cash(e,w,5000);
 refund:=public.upt_sales_refund(sal,1,'QA rollback');
 IF refund IS NULL OR NOT EXISTS(SELECT 1 FROM public.sales_transactions WHERE id=refund AND transaction_type='refund' AND original_sale_id=sal)
 THEN RAISE EXCEPTION 'Refund did not create auditable reversal'; END IF;
 shift:=public.upt_apply_planning_recommendation(a);
 IF shift IS NULL THEN RAISE EXCEPTION 'Planning apply did not create shift'; END IF;
 PERFORM public.upt_dismiss_planning_recommendation(d);
 generated:=public.upt_generate_planning_recommendations(e);
 IF generated<0 THEN RAISE EXCEPTION 'Planning generation invalid'; END IF;
 report:=public.upt_generate_event_report(e);
 IF report IS NULL THEN RAISE EXCEPTION 'Event report missing'; END IF;
END $positive$;
SELECT 'PASS' AS verdict,12 AS native_action_sql_positive_checks,true AS all_changes_rolled_back;
ROLLBACK;

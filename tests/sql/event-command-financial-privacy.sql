-- Database-level revenue confidentiality with a real authenticated Staff/Head Admin.
-- All synthetic records and the sale are transactionally rolled back.
BEGIN;
CREATE TEMP TABLE qa_finance_ids(name text primary key,id uuid default gen_random_uuid());
INSERT INTO qa_finance_ids(name) VALUES ('staff'),('event'),('workplace'),('inventory');
GRANT SELECT ON qa_finance_ids TO authenticated;

INSERT INTO auth.users(id,email)
SELECT id,name||'@qa-finance-rollback.test' FROM qa_finance_ids WHERE name='staff';
UPDATE public.profiles p SET approved=true,account_blocked=false,role='staff'
FROM qa_finance_ids x WHERE x.name='staff' AND p.id=x.id;

INSERT INTO public.events(id,name,start_date,end_date,start_at,end_at,status,created_by)
SELECT id,'Restricted revenue fixture',now()-interval '1 hour',now()+interval '1 hour',
       now()-interval '1 hour',now()+interval '1 hour','active',
       (select p.id from public.profiles p where p.role='admin' and p.approved limit 1)
FROM qa_finance_ids WHERE name='event';
INSERT INTO public.workplaces(id,event_id,name)
VALUES((SELECT id FROM qa_finance_ids WHERE name='workplace'),
       (SELECT id FROM qa_finance_ids WHERE name='event'),'Sales test');
INSERT INTO public.event_members(event_id,user_id)
VALUES((SELECT id FROM qa_finance_ids WHERE name='event'),
       (SELECT id FROM qa_finance_ids WHERE name='staff'));
INSERT INTO public.inventory_items(id,event_id,workplace_id,name,total_quantity,available_quantity,created_by)
VALUES((SELECT id FROM qa_finance_ids WHERE name='inventory'),
       (SELECT id FROM qa_finance_ids WHERE name='event'),
       (SELECT id FROM qa_finance_ids WHERE name='workplace'),
       'QA product',20,20,
       (select p.id from public.profiles p where p.role='admin' and p.approved limit 1));
INSERT INTO public.sales_transactions(event_id,workplace_id,inventory_item_id,seller_id,
                                      product_name,sale_category,quantity,unit_price_cents,payment_method)
VALUES((SELECT id FROM qa_finance_ids WHERE name='event'),
       (SELECT id FROM qa_finance_ids WHERE name='workplace'),
       (SELECT id FROM qa_finance_ids WHERE name='inventory'),
       (select p.id from public.profiles p where p.role='admin' and p.approved limit 1),
       'QA product','merch',2,1017,'cash');

-- A genuine member may still read non-sensitive operational readiness,
-- but must not receive sales totals in the JSON response.
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM qa_finance_ids WHERE name='staff'),true);
SET LOCAL ROLE authenticated;
DO $staff_guard$
DECLARE v_data jsonb;
BEGIN
 SELECT public.upt_event_command_snapshot((SELECT id FROM qa_finance_ids WHERE name='event'))
 INTO v_data;
 IF v_data->'event'->>'name' <> 'Restricted revenue fixture'
  OR v_data->'staffing' IS NULL
  OR (v_data->'sales'->>'netCents')::bigint<>0
  OR (v_data->'sales'->>'merchCents')::bigint<>0
  OR (v_data->'sales'->>'tokenCents')::bigint<>0
 THEN
  RAISE EXCEPTION 'FAIL: Staff sees financial totals or loses operational snapshot';
 END IF;
END $staff_guard$;
RESET ROLE;

-- A real approved Head Admin still receives accurate sales data.
SELECT set_config('request.jwt.claim.sub',
  (SELECT p.id::text FROM public.profiles p WHERE p.role='admin' and p.approved LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $admin_guard$
DECLARE v_data jsonb;
BEGIN
 SELECT public.upt_event_command_snapshot((SELECT id FROM qa_finance_ids WHERE name='event'))
 INTO v_data;
 IF (v_data->'sales'->>'netCents')::bigint<>2034
    OR (v_data->'sales'->>'merchCents')::bigint<>2034 THEN
  RAISE EXCEPTION 'FAIL: Authorized Admin lost accurate event revenue';
 END IF;
END $admin_guard$;
RESET ROLE;
SELECT 'PASS: operational Staff sees no revenue, Head Admin sees accurate sales without leaking data' AS result;
ROLLBACK;

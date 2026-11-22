-- Main-QA ONLY, exact project npbjrtiolqperdgljnhi.
-- Security test of the 12 portable native action RPCs in ONE rollback transaction.
-- No auth account provision, persisted rows, money movement or real-event IDs.
-- Fails closed unless the seven expected QA-only bot identities are present.
-- DO NOT run against production. The caller must target Main-QA explicitly.
-- Application-level positive mutation parity remains separate and NOT proven.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
DO $inventory$
DECLARE head_id uuid; staff_id uuid;
 n integer; auth_access boolean; anon_access boolean;
BEGIN
 IF (SELECT count(*) FROM auth.users WHERE email LIKE 'e2e-%@uptilldawn.test')<>7 THEN
  RAISE EXCEPTION 'QA-only guard: seven fixed QA accounts required';
 END IF;
 SELECT id INTO STRICT head_id FROM auth.users WHERE email='e2e-head-admin@uptilldawn.test';
 SELECT id INTO STRICT staff_id FROM auth.users WHERE email='e2e-staff@uptilldawn.test';
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=head_id AND role='admin' AND approved=true AND account_blocked=false) OR
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=staff_id AND role='staff' AND approved=true AND account_blocked=false)
 THEN RAISE EXCEPTION 'QA-only guard: wrong account role or approval'; END IF;
 SELECT count(*),bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE')),
        bool_or(has_function_privilege('anon',p.oid,'EXECUTE'))
 INTO n,auth_access,anon_access FROM pg_proc p
 WHERE p.pronamespace='public'::regnamespace AND p.proname IN (
   'upt_guestlist_add_entry',
   'upt_guestlist_update_entry',
   'upt_guestlist_remove_entry',
   'upt_guestlist_set_backstage_workplace',
   'upt_guestlist_set_artist_hospitality',
   'upt_sales_configure_item',
   'upt_sales_set_opening_cash',
   'upt_sales_refund',
   'upt_generate_planning_recommendations',
   'upt_apply_planning_recommendation',
   'upt_dismiss_planning_recommendation',
   'upt_generate_event_report'
 );
 IF n<>12 OR auth_access IS DISTINCT FROM true OR anon_access IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'Native RPC signature or privilege drift';
 END IF;
 PERFORM set_config('qa.native.head_id',head_id::text,true);
 PERFORM set_config('qa.native.staff_id',staff_id::text,true);
END
$inventory$;
SET LOCAL ROLE authenticated;
DO $deny_staff$
DECLARE
 actions text[]:=ARRAY[
   'SELECT public.upt_guestlist_add_entry(gen_random_uuid(),''QA rollback probe'',''guest'',1,NULL)',
   'SELECT public.upt_guestlist_update_entry(gen_random_uuid(),''QA rollback probe'',''guest'',1,NULL)',
   'SELECT public.upt_guestlist_remove_entry(gen_random_uuid())',
   'SELECT public.upt_guestlist_set_backstage_workplace(gen_random_uuid(),gen_random_uuid())',
   'SELECT public.upt_guestlist_set_artist_hospitality(gen_random_uuid(),''water'',NULL)',
   'SELECT public.upt_sales_configure_item(gen_random_uuid(),true,''merch'',100)',
   'SELECT public.upt_sales_set_opening_cash(gen_random_uuid(),gen_random_uuid(),100)',
   'SELECT public.upt_sales_refund(gen_random_uuid(),1,NULL)',
   'SELECT public.upt_generate_planning_recommendations(gen_random_uuid())',
   'SELECT public.upt_apply_planning_recommendation(gen_random_uuid())',
   'SELECT public.upt_dismiss_planning_recommendation(gen_random_uuid())',
   'SELECT public.upt_generate_event_report(gen_random_uuid())'
 ];
 stmt text; error_state text; error_message text;
 refused boolean; verified integer:=0;
BEGIN
 IF current_user<>'authenticated' THEN RAISE EXCEPTION 'Role simulation invalid'; END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa.native.staff_id'),true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 IF auth.uid() IS NULL OR public.upt_is_approved() IS DISTINCT FROM true OR
    public.upt_is_admin(auth.uid()) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'Staff security context invalid'; END IF;
 FOREACH stmt IN ARRAY actions LOOP
  refused:=false;
  BEGIN
   EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS error_state=RETURNED_SQLSTATE,error_message=MESSAGE_TEXT;
   IF error_state NOT IN ('P0001','42501') OR
      (error_message NOT ILIKE 'Alleen admin%' AND error_message NOT ILIKE 'Geen toegang tot eventrapport%')
   THEN RAISE EXCEPTION 'Staff failure did not originate in original admin guard (%).',error_state;
   END IF;
   refused:=true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'Unauthorized staff action unexpectedly succeeded'; END IF;
  verified:=verified+1;
 END LOOP;
 IF verified<>12 THEN RAISE EXCEPTION 'Only % of 12 staff denials verified',verified; END IF;
END
$deny_staff$;
DO $head_authorization$
DECLARE
 actions text[]:=ARRAY[
   'SELECT public.upt_guestlist_add_entry(gen_random_uuid(),''QA rollback probe'',''guest'',1,NULL)',
   'SELECT public.upt_guestlist_update_entry(gen_random_uuid(),''QA rollback probe'',''guest'',1,NULL)',
   'SELECT public.upt_guestlist_remove_entry(gen_random_uuid())',
   'SELECT public.upt_guestlist_set_backstage_workplace(gen_random_uuid(),gen_random_uuid())',
   'SELECT public.upt_guestlist_set_artist_hospitality(gen_random_uuid(),''water'',NULL)',
   'SELECT public.upt_sales_configure_item(gen_random_uuid(),true,''merch'',100)',
   'SELECT public.upt_sales_set_opening_cash(gen_random_uuid(),gen_random_uuid(),100)',
   'SELECT public.upt_sales_refund(gen_random_uuid(),1,NULL)',
   'SELECT public.upt_generate_planning_recommendations(gen_random_uuid())',
   'SELECT public.upt_apply_planning_recommendation(gen_random_uuid())',
   'SELECT public.upt_dismiss_planning_recommendation(gen_random_uuid())',
   'SELECT public.upt_generate_event_report(gen_random_uuid())'
 ];
 stmt text; error_state text; error_message text;
 rejected_missing_fixture boolean; verified integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('qa.native.head_id'),true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 IF auth.uid() IS NULL OR public.upt_is_approved() IS DISTINCT FROM true OR
    public.upt_is_admin(auth.uid()) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Head admin security context invalid'; END IF;
 FOREACH stmt IN ARRAY actions LOOP
  rejected_missing_fixture:=false;
  BEGIN
   EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS error_state=RETURNED_SQLSTATE,error_message=MESSAGE_TEXT;
   IF error_state<>'P0001' OR NOT (
     error_message ILIKE '%niet gevonden%' OR
     error_message ILIKE '%niet meer actief%' OR
     error_message ILIKE '%geldige%werkplek%' OR
     error_message ILIKE '%niet beschikbaar%')
   THEN RAISE EXCEPTION 'Head admin was denied unexpectedly (state %).',error_state;
   END IF;
   rejected_missing_fixture:=true;
  END;
  IF NOT rejected_missing_fixture THEN RAISE EXCEPTION 'Synthetic nonexistent action unexpectedly succeeded'; END IF;
  verified:=verified+1;
 END LOOP;
 IF verified<>12 THEN RAISE EXCEPTION 'Only % of 12 head-admin paths verified',verified; END IF;
END
$head_authorization$;
SELECT 'PASS' AS verdict,
 12 AS staff_action_denials,12 AS authorized_head_missing_resource_checks,
 12 AS authenticated_only_rpc_grants,
 true AS single_transaction_rollback;
ROLLBACK;

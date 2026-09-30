-- 15-bot full event simulation. Synthetic fixtures only; transaction always rolls back.
BEGIN;

CREATE TEMP TABLE bot_ids(name text primary key,id uuid default gen_random_uuid());
INSERT INTO bot_ids(name)
SELECT 'bot_'||lpad(n::text,2,'0') FROM generate_series(1,15) n;
INSERT INTO bot_ids(name) VALUES ('event'),('wp_entrance'),('wp_bar'),('wp_backstage');
GRANT SELECT ON bot_ids TO authenticated;

INSERT INTO auth.users(id,email)
SELECT id,name||'@bots.uptilldawn.test' FROM bot_ids WHERE name like 'bot_%';

UPDATE public.profiles p SET approved=true,
 role=case when b.name='bot_01' then 'admin' when b.name in ('bot_02','bot_03','bot_04') then 'responsible_lead' else 'staff' end,
 full_name='E2E '||b.name
FROM bot_ids b WHERE p.id=b.id AND b.name like 'bot_%';

INSERT INTO public.events(id,name,start_date,end_date,start_at,end_at,status,created_by)
VALUES((SELECT id FROM bot_ids WHERE name='event'),'15 Bot Full Event',now()-interval '1 hour',now()+interval '8 hours',now()-interval '1 hour',now()+interval '8 hours','active',(SELECT id FROM bot_ids WHERE name='bot_01'));

INSERT INTO public.workplaces(id,event_id,name,minimum_staff,target_staff,sort_order) VALUES
((SELECT id FROM bot_ids WHERE name='wp_entrance'),(SELECT id FROM bot_ids WHERE name='event'),'Entrance',2,4,10),
((SELECT id FROM bot_ids WHERE name='wp_bar'),(SELECT id FROM bot_ids WHERE name='event'),'Bar',2,4,20),
((SELECT id FROM bot_ids WHERE name='wp_backstage'),(SELECT id FROM bot_ids WHERE name='event'),'Backstage',2,4,30);

INSERT INTO public.event_members(event_id,user_id,event_role)
SELECT (SELECT id FROM bot_ids WHERE name='event'),id,
 case when name in ('bot_02','bot_03','bot_04') then 'responsible_lead' else 'employee' end
FROM bot_ids WHERE name like 'bot_%' and name<>'bot_01';

INSERT INTO public.responsible_assignments(event_id,workplace_id,user_id,assigned_by) VALUES
((SELECT id FROM bot_ids WHERE name='event'),(SELECT id FROM bot_ids WHERE name='wp_entrance'),(SELECT id FROM bot_ids WHERE name='bot_02'),(SELECT id FROM bot_ids WHERE name='bot_01')),
((SELECT id FROM bot_ids WHERE name='event'),(SELECT id FROM bot_ids WHERE name='wp_bar'),(SELECT id FROM bot_ids WHERE name='bot_03'),(SELECT id FROM bot_ids WHERE name='bot_01')),
((SELECT id FROM bot_ids WHERE name='event'),(SELECT id FROM bot_ids WHERE name='wp_backstage'),(SELECT id FROM bot_ids WHERE name='bot_04'),(SELECT id FROM bot_ids WHERE name='bot_01'));

-- Admin schedules all 14 operational bots over three workplaces.
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM bot_ids WHERE name='bot_01'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE n int; wp uuid;
BEGIN
 FOR n IN 2..15 LOOP
  wp:=case when n in (2,5,6,7,8) then (SELECT id FROM bot_ids WHERE name='wp_entrance')
           when n in (3,9,10,11,12) then (SELECT id FROM bot_ids WHERE name='wp_bar')
           else (SELECT id FROM bot_ids WHERE name='wp_backstage') end;
  PERFORM public.upt_create_shift(wp,(SELECT id FROM bot_ids WHERE name='bot_'||lpad(n::text,2,'0')),
    case when n<=4 then 'Verantwoordelijke' else 'Personeel' end,now()-interval '30 minutes',now()+interval '6 hours',false);
 END LOOP;
END $$;
RESET ROLE;

-- All staff bots exercise their own authenticated availability write under RLS.
-- Role changes must happen outside PL/pgSQL so auth.uid() observes each bot JWT claim.
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM bot_ids WHERE name='bot_05'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.event_availability(event_id,user_id,response)
VALUES((SELECT id FROM bot_ids WHERE name='event'),auth.uid(),'can');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM bot_ids WHERE name='bot_06'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.event_availability(event_id,user_id,response)
VALUES((SELECT id FROM bot_ids WHERE name='event'),auth.uid(),'can');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM bot_ids WHERE name='bot_07'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.event_availability(event_id,user_id,response)
VALUES((SELECT id FROM bot_ids WHERE name='event'),auth.uid(),'can');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM bot_ids WHERE name='bot_08'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.event_availability(event_id,user_id,response)
VALUES((SELECT id FROM bot_ids WHERE name='event'),auth.uid(),'can');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM bot_ids WHERE name='bot_09'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.event_availability(event_id,user_id,response)
VALUES((SELECT id FROM bot_ids WHERE name='event'),auth.uid(),'can');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM bot_ids WHERE name='bot_10'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.event_availability(event_id,user_id,response)
VALUES((SELECT id FROM bot_ids WHERE name='event'),auth.uid(),'can');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM bot_ids WHERE name='bot_11'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.event_availability(event_id,user_id,response)
VALUES((SELECT id FROM bot_ids WHERE name='event'),auth.uid(),'can');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM bot_ids WHERE name='bot_12'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.event_availability(event_id,user_id,response)
VALUES((SELECT id FROM bot_ids WHERE name='event'),auth.uid(),'can');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM bot_ids WHERE name='bot_13'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.event_availability(event_id,user_id,response)
VALUES((SELECT id FROM bot_ids WHERE name='event'),auth.uid(),'can');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM bot_ids WHERE name='bot_14'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.event_availability(event_id,user_id,response)
VALUES((SELECT id FROM bot_ids WHERE name='event'),auth.uid(),'can');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM bot_ids WHERE name='bot_15'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.event_availability(event_id,user_id,response)
VALUES((SELECT id FROM bot_ids WHERE name='event'),auth.uid(),'can');
RESET ROLE;

-- Validate the shared event state produced by all 15 actors.
DO $$
DECLARE members int; shifts_count int; avail int; leads int;
BEGIN
 SELECT count(*) INTO members FROM public.event_members WHERE event_id=(SELECT id FROM bot_ids WHERE name='event');
 SELECT count(*) INTO shifts_count FROM public.shifts WHERE event_id=(SELECT id FROM bot_ids WHERE name='event');
 SELECT count(*) INTO avail FROM public.event_availability WHERE event_id=(SELECT id FROM bot_ids WHERE name='event');
 SELECT count(*) INTO leads FROM public.responsible_assignments WHERE event_id=(SELECT id FROM bot_ids WHERE name='event');
 IF members<>14 THEN RAISE EXCEPTION 'FAIL members %, expected 14',members; END IF;
 IF shifts_count<>14 THEN RAISE EXCEPTION 'FAIL shifts %, expected 14',shifts_count; END IF;
 IF avail<>11 THEN RAISE EXCEPTION 'FAIL availability %, expected 11',avail; END IF;
 IF leads<>3 THEN RAISE EXCEPTION 'FAIL responsibles %, expected 3',leads; END IF;
END $$;

SELECT 'PASS: 15-bot full-event role, staffing, workplace, shift and availability simulation' AS result;
ROLLBACK;

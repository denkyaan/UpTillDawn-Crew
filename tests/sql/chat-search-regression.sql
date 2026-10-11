-- Execute the real search RPC on synthetic data only; the transaction rolls back.
BEGIN;

CREATE TEMP TABLE search_test_ids(name text primary key,id uuid default gen_random_uuid());
INSERT INTO search_test_ids(name) VALUES ('crew'),('event'),('media'),('document'),('plain');

INSERT INTO auth.users(id,email)
SELECT id,name||'@chat-search.example.invalid'
FROM search_test_ids WHERE name='crew';

UPDATE public.profiles p SET approved=true,role='staff',full_name='Chat Search Tester'
FROM search_test_ids t WHERE p.id=t.id AND t.name='crew';

INSERT INTO public.events(id,name,start_date,end_date,start_at,end_at,status,created_by)
SELECT (SELECT id FROM search_test_ids WHERE name='event'),
       'Search Test Event',now()-interval '1 hour',now()+interval '2 hours',
       now()-interval '1 hour',now()+interval '2 hours','active',
       (SELECT id FROM search_test_ids WHERE name='crew');

INSERT INTO public.event_members(event_id,user_id,event_role)
VALUES ((SELECT id FROM search_test_ids WHERE name='event'),
        (SELECT id FROM search_test_ids WHERE name='crew'),'employee');

INSERT INTO public.messages(id,user_id,sender_id,channel_id,body,content)
SELECT t.id,
       (SELECT id FROM search_test_ids WHERE name='crew'),
       (SELECT id FROM search_test_ids WHERE name='crew'),
       (SELECT c.id FROM public.chat_channels c
        WHERE c.kind='event' AND c.event_id=(SELECT id FROM search_test_ids WHERE name='event') LIMIT 1),
       CASE WHEN t.name='plain' THEN 'Plain release search'
            ELSE 'Receipt release search' END,
       CASE WHEN t.name='plain' THEN 'Plain release search'
            ELSE 'Receipt release search' END
FROM search_test_ids t WHERE t.name IN ('media','document','plain');

INSERT INTO public.message_attachments(message_id,file_url,storage_path,mime_type)
VALUES
 ((SELECT id FROM search_test_ids WHERE name='media'),'demo/search.png','demo/search.png','image/png'),
 ((SELECT id FROM search_test_ids WHERE name='document'),'demo/search.pdf','demo/search.pdf','application/pdf');

SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM search_test_ids WHERE name='crew'),true);
SET LOCAL ROLE authenticated;

DO $check$
DECLARE
 ch uuid := (SELECT id FROM public.chat_channels WHERE kind='event'
   AND event_id=(SELECT id FROM search_test_ids WHERE name='event') LIMIT 1);
 actor uuid := (SELECT id FROM search_test_ids WHERE name='crew');
 actual integer;
BEGIN
 SELECT count(*) INTO actual FROM public.upt_search_chat_messages(ch,'release search',actor,null,null,null,50);
 IF actual<>3 THEN RAISE EXCEPTION 'Search keyword or sender failed: %',actual; END IF;

 SELECT count(*) INTO actual FROM public.upt_search_chat_messages(ch,'Receipt',actor,'media',now()-interval '1 hour',now()+interval '1 hour',50);
 IF actual<>1 THEN RAISE EXCEPTION 'Combined media search failed: %',actual; END IF;

 SELECT count(*) INTO actual FROM public.upt_search_chat_messages(ch,'Receipt',actor,'file',null,null,50);
 IF actual<>1 THEN RAISE EXCEPTION 'Document search failed: %',actual; END IF;

 SELECT count(*) INTO actual FROM public.upt_search_chat_messages(ch,'Receipt',actor,'any',null,null,50);
 IF actual<>2 THEN RAISE EXCEPTION 'Any attachment search failed: %',actual; END IF;

 SELECT count(*) INTO actual FROM public.upt_search_chat_messages(ch,'Receipt',gen_random_uuid(),null,null,null,50);
 IF actual<>0 THEN RAISE EXCEPTION 'Sender restriction ignored'; END IF;

 SELECT count(*) INTO actual FROM public.upt_search_chat_messages(ch,'Receipt',actor,'media',now()+interval '1 hour',now()+interval '2 hours',50);
 IF actual<>0 THEN RAISE EXCEPTION 'Date restriction ignored'; END IF;

 SELECT count(*) INTO actual FROM public.upt_search_chat_messages(ch,'release search',actor,null,null,null,1);
 IF actual<>1 THEN RAISE EXCEPTION 'Search limit ignored'; END IF;

 BEGIN
  PERFORM public.upt_search_chat_messages(gen_random_uuid(),null,null,null,null,null,50);
  RAISE EXCEPTION 'Unauthorized channel search accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Unauthorized channel search accepted' THEN RAISE; END IF;
 END;
END $check$;

RESET ROLE;

DO $permissions$
BEGIN
 IF has_function_privilege('anon','public.upt_search_chat_messages(uuid,text,uuid,text,timestamptz,timestamptz,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'Anon may access chat search'; END IF;
END $permissions$;

SELECT 'PASS: production chat-search RPC filters, limit and authorization' AS result;
ROLLBACK;

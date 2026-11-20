-- Resolve PL/pgSQL RETURNS TABLE(channel_id) ambiguity in chat state upsert.
-- Preserve the existing SECURITY DEFINER function body and privileges.
DO $migration$
DECLARE
  function_sql text;
BEGIN
  SELECT pg_get_functiondef('public.upt_chat_channel_summaries()'::regprocedure)
    INTO function_sql;
  IF position('on conflict on constraint chat_user_states_pkey do nothing' IN function_sql) > 0 THEN
    RETURN;
  END IF;
  IF position('on conflict(channel_id,user_id) do nothing' IN function_sql) = 0 THEN
    RAISE EXCEPTION 'Unexpected upt_chat_channel_summaries definition; refusing automatic rewrite';
  END IF;
  function_sql := replace(
    function_sql,
    'on conflict(channel_id,user_id) do nothing',
    'on conflict on constraint chat_user_states_pkey do nothing'
  );
  EXECUTE function_sql;
END
$migration$;

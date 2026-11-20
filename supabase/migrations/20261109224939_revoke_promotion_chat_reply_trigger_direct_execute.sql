-- A trigger function is executed by PostgreSQL through its trigger, not
-- directly by authenticated application clients. Close the default EXECUTE grant.
revoke all on function public.upt_validate_promotion_chat_reply()
 from public, anon, authenticated;

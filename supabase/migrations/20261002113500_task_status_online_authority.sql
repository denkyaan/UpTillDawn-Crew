-- Document the online task-status authority used by the client. The RPC already performs
-- row locking, ownership validation, feature gating and audit logging; retain explicit grants.
revoke all on function public.upt_update_task_status(uuid,text) from public,anon;
grant execute on function public.upt_update_task_status(uuid,text) to authenticated;
notify pgrst,'reload schema';

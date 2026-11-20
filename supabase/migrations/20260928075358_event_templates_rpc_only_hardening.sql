-- Event templates are RPC-managed. Keep reads for authorized admins, remove direct browser mutation grants.
revoke insert,update,delete on table public.event_templates from authenticated;
grant select on table public.event_templates to authenticated;
notify pgrst,'reload schema';

-- Event templates are managed only through audited admin RPCs.
revoke insert,update,delete on table public.event_templates from authenticated;

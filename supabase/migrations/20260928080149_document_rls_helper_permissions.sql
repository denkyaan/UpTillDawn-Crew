-- RLS/storage policy helper: authenticated policy evaluation requires EXECUTE.
-- The helper remains in the private schema, returns only a scoped boolean, and is not granted to anon/PUBLIC.
grant execute on function upt_private.document_can_view(uuid,uuid,text) to authenticated;

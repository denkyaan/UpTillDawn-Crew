-- Public tables were historically granted broad table-level privileges to
-- authenticated database roles. RLS limits normal SELECT/UPDATE/DELETE, but
-- TRUNCATE is a table operation and does NOT apply RLS row policies.
-- Ordinary application users never need TRUNCATE, REFERENCES or TRIGGER.
--
-- Revoke only these three privileges. Preserve SELECT/INSERT/UPDATE/DELETE
-- as required by existing crew workflows; their RLS policies remain
-- authoritative. Existing table owners and service-role maintenance are not
-- changed. This is additive, idempotent permission hardening.
do $$
declare
 entry record;
begin
 for entry in
  select n.nspname as schema_name,c.relname as table_name
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
  order by c.oid
 loop
  execute format(
   'revoke truncate, references, trigger on table %I.%I from public, anon, authenticated',
   entry.schema_name,entry.table_name
  );
 end loop;
end;
$$;

-- This migration deliberately does NOT grant powerful privileges, rewrite
-- existing row policies, or revoke necessary row-scoped application DML.
-- Rerun the SQL regression after future schema migrations that add tables.

-- All public app tables must remain protected from RLS-bypassing TRUNCATE
-- and unauthorized trigger/FK creation by public database roles.
do $$
declare
 leak_count integer;
 entry record;
begin
 select count(*) into leak_count
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p')
 and (
  has_table_privilege('authenticated',c.oid,'TRUNCATE') or
  has_table_privilege('authenticated',c.oid,'TRIGGER') or
  has_table_privilege('authenticated',c.oid,'REFERENCES') or
  has_table_privilege('anon',c.oid,'TRUNCATE') or
  has_table_privilege('anon',c.oid,'TRIGGER') or
  has_table_privilege('anon',c.oid,'REFERENCES')
 );
 if leak_count<>0 then
  raise exception 'Unsafe public table privilege remains on % table(s)',leak_count;
 end if;
 if not has_table_privilege('authenticated','public.tasks','SELECT')
    or not has_table_privilege('authenticated','public.admin_financial_attachments','SELECT')
    or not has_table_privilege('authenticated','public.admin_financial_attachments','INSERT') then
  raise exception 'Security migration removed required, RLS-governed DML grants';
 end if;
 raise notice 'PASS: no anon/authenticated TRUNCATE/TRIGGER/REFERENCES grants on public tables; required app DML preserved';
end;
$$;

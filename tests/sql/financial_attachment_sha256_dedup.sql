-- Source verification: the archive must preserve historic attachments while
-- enforcing byte-level duplicate prevention for newly registered fingerprints.
do $$
declare
 v_check text;
 v_index text;
 v_pred text;
 v_unique boolean;
begin
 select pg_get_constraintdef(c.oid) into v_check
 from pg_constraint c
 where c.conrelid='public.admin_financial_attachments'::regclass
 and c.conname='admin_financial_attachments_sha256_valid';
 if v_check is null or position('sha256' in v_check)=0
    or position('{64}' in v_check)=0 then
  raise exception 'Missing 64-digit SHA-256 attachment constraint';
 end if;
 select pg_get_indexdef(i.indexrelid),
        pg_get_expr(i.indpred,i.indrelid),
        i.indisunique into v_index,v_pred,v_unique
 from pg_index i
 join pg_class idx on idx.oid=i.indexrelid
 where idx.relname='admin_financial_attachments_document_sha256_unique';
 if v_index is null or v_unique is distinct from true
    or position('(document_id, sha256)' in v_index)=0
    or position('sha256 IS NOT NULL' in v_pred)=0 then
  raise exception 'Missing per-document partial uniqueness for SHA-256 attachments';
 end if;
 if has_table_privilege('authenticated','public.admin_financial_attachments','UPDATE')
    or has_table_privilege('authenticated','public.admin_financial_attachments','DELETE') then
  raise exception 'Financial attachment metadata must remain immutable for authenticated users';
 end if;
 raise notice 'PASS: historic attachment hashes nullable, exact 64-hex SHA-256, unique per document and immutable metadata';
end;
$$;

alter table upt_private.god_data_audit
  add column if not exists actor_id uuid default auth.uid(),
  add column if not exists rollback_of bigint,
  add column if not exists reverted_at timestamptz,
  add column if not exists reverted_by_audit_id bigint;

create index if not exists god_data_audit_changed_idx
on upt_private.god_data_audit(changed_at desc);

create index if not exists god_data_audit_table_changed_idx
on upt_private.god_data_audit(table_name,changed_at desc);

create index if not exists god_data_audit_rollback_of_idx
on upt_private.god_data_audit(rollback_of)
where rollback_of is not null;

create or replace function public.upt_god_data_audit_list(p_token text,p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','upt_private'
as $fn$
declare
  v_result jsonb;
begin
  if not upt_private.god_session_valid(p_token) then raise exception 'Invalid God Mode session'; end if;
  if p_limit is null or p_limit<1 or p_limit>200 then raise exception 'Invalid limit'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.changed_at desc),'[]'::jsonb)
  into v_result
  from(
    select
      id,changed_at,table_name,operation,before_row,after_row,actor_id,
      rollback_of,reverted_at,reverted_by_audit_id
    from upt_private.god_data_audit
    order by changed_at desc
    limit p_limit
  )x;
  return v_result;
end;
$fn$;

create or replace function public.upt_god_data_rollback(p_token text,p_audit_id bigint)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','upt_private'
as $fn$
declare
  v_audit upt_private.god_data_audit%rowtype;
  v_table oid;
  v_col text;
  v_columns text;
  v_select text;
  v_set text;
  v_current jsonb;
  v_after jsonb;
  v_rollback_id bigint;
begin
  if not upt_private.god_session_valid(p_token) then raise exception 'Invalid God Mode session'; end if;

  select * into v_audit
  from upt_private.god_data_audit
  where id=p_audit_id
  for update;

  if not found then raise exception 'Audit entry not found'; end if;
  if v_audit.operation not in('insert','update','delete') then raise exception 'This audit entry cannot be rolled back'; end if;
  if v_audit.reverted_at is not null then raise exception 'This change was already rolled back'; end if;

  select c.oid into v_table
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname=v_audit.table_name
    and c.relkind in('r','p');

  if v_table is null then raise exception 'Target table no longer exists'; end if;

  for v_col in
    select a.attname
    from pg_attribute a
    where a.attrelid=v_table
      and a.attnum>0
      and not a.attisdropped
      and a.attgenerated=''
      and a.attidentity=''
    order by a.attnum
  loop
    v_columns:=concat_ws(',',v_columns,format('%I',v_col));
    v_select:=concat_ws(',',v_select,format('r.%I',v_col));
    v_set:=concat_ws(',',v_set,format('%I=r.%I',v_col,v_col));
  end loop;

  if v_columns is null then raise exception 'No rollbackable columns found'; end if;

  if v_audit.operation='insert' then
    execute format(
      'delete from public.%I t where to_jsonb(t)=$1 returning to_jsonb(t.*)',
      v_audit.table_name
    )
    into v_current
    using v_audit.after_row;

    if v_current is null then raise exception 'Row changed since the original insert; rollback refused'; end if;
    v_after:=null;

  elsif v_audit.operation='delete' then
    execute format(
      'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r returning to_jsonb(%I.*)',
      v_audit.table_name,v_columns,v_select,v_audit.table_name,v_audit.table_name
    )
    into v_after
    using v_audit.before_row;
    v_current:=null;

  else
    execute format(
      'select to_jsonb(t) from public.%I t where to_jsonb(t)=$1 for update',
      v_audit.table_name
    )
    into v_current
    using v_audit.after_row;

    if v_current is null then raise exception 'Row changed since the original update; rollback refused'; end if;

    execute format(
      'update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) r where to_jsonb(t)=$2 returning to_jsonb(t.*)',
      v_audit.table_name,v_set,v_audit.table_name
    )
    into v_after
    using v_audit.before_row,v_audit.after_row;

    if v_after is null then raise exception 'Rollback update failed'; end if;
  end if;

  insert into upt_private.god_data_audit(
    table_name,operation,before_row,after_row,actor_id,rollback_of
  )
  values(
    v_audit.table_name,'rollback',v_current,v_after,auth.uid(),v_audit.id
  )
  returning id into v_rollback_id;

  update upt_private.god_data_audit
  set reverted_at=now(),reverted_by_audit_id=v_rollback_id
  where id=v_audit.id;

  return jsonb_build_object('ok',true,'auditId',v_rollback_id,'row',v_after);
end;
$fn$;

revoke all on function public.upt_god_data_audit_list(text,integer),public.upt_god_data_rollback(text,bigint)
from public;
grant execute on function public.upt_god_data_audit_list(text,integer),public.upt_god_data_rollback(text,bigint)
to anon,authenticated;

notify pgrst,'reload schema';


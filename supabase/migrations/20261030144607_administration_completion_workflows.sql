-- Authenticated import and payroll workflows. No provider transmission or fund transfer.
create schema if not exists upt_administration_private;
revoke all on schema upt_administration_private from public,anon;
grant usage on schema upt_administration_private to authenticated;

create table public.admin_ticket_imports (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id),
 source text not null check (source ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
 file_sha256 text not null check (file_sha256 ~ '^[a-f0-9]{64}$'),
 payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
 inserted_rows integer not null check (inserted_rows between 0 and 10000),
 skipped_rows integer not null check (skipped_rows between 0 and 10000),
 quantity bigint not null check (quantity >= 0),
 gross_cents bigint not null check (gross_cents >= 0),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(event_id,source,file_sha256)
);
create index admin_ticket_imports_actor_idx on public.admin_ticket_imports(created_by);
create table public.admin_ticket_sales (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id),
 source text not null,
 external_id text not null check (length(external_id) between 1 and 160 and external_id !~ '^[=+@-]'),
 quantity integer not null check (quantity between 1 and 100000),
 gross_cents bigint not null check (gross_cents between 0 and 999999999999),
 currency text not null check (currency='EUR'),
 sold_at timestamptz not null check (isfinite(sold_at)),
 import_id uuid not null references public.admin_ticket_imports(id),
 unique(event_id,source,external_id)
);
create index admin_ticket_sales_import_idx on public.admin_ticket_sales(import_id);
alter table public.admin_ticket_imports enable row level security;
alter table public.admin_ticket_sales enable row level security;
revoke all on public.admin_ticket_imports,public.admin_ticket_sales from public,anon,authenticated;
grant select on public.admin_ticket_imports,public.admin_ticket_sales to authenticated;
create policy admin_ticket_imports_read on public.admin_ticket_imports for select to authenticated
 using ((select public.upt_can_manage_administration()));
create policy admin_ticket_sales_read on public.admin_ticket_sales for select to authenticated
 using ((select public.upt_can_manage_administration()));

create function upt_administration_private.import_ticket_sales(p_event uuid,p_source text,p_sha256 text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_id uuid; v_hash text; v_existing public.admin_ticket_imports;
 v_row jsonb; v_sale public.admin_ticket_sales; v_added integer:=0; v_skipped integer:=0;
 v_quantity bigint:=0; v_gross bigint:=0;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration required' using errcode='42501';
 end if;
 if p_event is null or p_source is null or p_source !~ '^[a-z0-9][a-z0-9_-]{0,39}$'
 or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
 or p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Invalid ticket import'; end if;
 if jsonb_array_length(p_rows) not between 1 and 10000 or octet_length(p_rows::text)>4000000 then raise exception 'Ticket import too large'; end if;
 if not exists(select 1 from public.events where id=p_event) then raise exception 'Event unavailable'; end if;
 -- Serialize imports within an event/channel, including concurrent overlapping files.
 perform pg_advisory_xact_lock(hashtextextended(p_event::text||':'||p_source,0));
 v_hash:=encode(sha256(convert_to(p_rows::text,'UTF8')),'hex');
 select * into v_existing from public.admin_ticket_imports where event_id=p_event and source=p_source and file_sha256=p_sha256;
 if found then
  if v_existing.payload_sha256<>v_hash then raise exception 'Import fingerprint conflict' using errcode='23505'; end if;
  return jsonb_build_object('id',v_existing.id,'inserted',0,'skipped',jsonb_array_length(p_rows),'replayed',true);
 end if;
 if exists(select 1 from jsonb_array_elements(p_rows)r group by r->>'externalId' having count(*)>1) then raise exception 'Duplicate sale identifiers'; end if;
 insert into public.admin_ticket_imports(event_id,source,file_sha256,payload_sha256,inserted_rows,skipped_rows,quantity,gross_cents,created_by)
 values(p_event,p_source,p_sha256,v_hash,0,0,0,0,auth.uid()) returning id into v_id;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(v_row)<>'object' or v_row->>'eventId' is distinct from p_event::text
  or v_row->>'currency' is distinct from 'EUR'
  or coalesce(length(v_row->>'externalId'),0) not between 1 and 160
  or v_row->>'externalId' ~ '^[=+@-]'
  or coalesce(v_row->>'quantity','') !~ '^[0-9]{1,6}$'
  or coalesce(v_row->>'grossCents','') !~ '^[0-9]{1,12}$'
  or coalesce(v_row->>'soldAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
  then raise exception 'Invalid ticket sale'; end if;
  if (v_row->>'quantity')::integer not between 1 and 100000 then raise exception 'Invalid ticket quantity'; end if;
  select * into v_sale from public.admin_ticket_sales where event_id=p_event and source=p_source and external_id=v_row->>'externalId';
  if found then
   if v_sale.quantity<>(v_row->>'quantity')::integer or v_sale.gross_cents<>(v_row->>'grossCents')::bigint
   or v_sale.sold_at<>(v_row->>'soldAt')::timestamptz then raise exception 'Conflicting ticket sale' using errcode='23505'; end if;
   v_skipped:=v_skipped+1;
  else
   insert into public.admin_ticket_sales(event_id,source,external_id,quantity,gross_cents,currency,sold_at,import_id)
   values(p_event,p_source,v_row->>'externalId',(v_row->>'quantity')::integer,(v_row->>'grossCents')::bigint,'EUR',(v_row->>'soldAt')::timestamptz,v_id);
   v_added:=v_added+1; v_quantity:=v_quantity+(v_row->>'quantity')::integer; v_gross:=v_gross+(v_row->>'grossCents')::bigint;
  end if;
 end loop;
 update public.admin_ticket_imports set inserted_rows=v_added,skipped_rows=v_skipped,quantity=v_quantity,gross_cents=v_gross where id=v_id;
 return jsonb_build_object('id',v_id,'inserted',v_added,'skipped',v_skipped,'replayed',false);
end $$;
revoke all on function upt_administration_private.import_ticket_sales(uuid,text,text,jsonb) from public,anon;
grant execute on function upt_administration_private.import_ticket_sales(uuid,text,text,jsonb) to authenticated;
create function public.upt_import_ticket_sales(p_event uuid,p_source text,p_sha256 text,p_rows jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select upt_administration_private.import_ticket_sales(p_event,p_source,p_sha256,p_rows);
$$;
revoke all on function public.upt_import_ticket_sales(uuid,text,text,jsonb) from public,anon;
grant execute on function public.upt_import_ticket_sales(uuid,text,text,jsonb) to authenticated;

-- One MVCC snapshot: no 50/500-record sample presented as complete revenue.
create function public.upt_ticket_sales_summary(p_event uuid default null)
returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(r),'[]'::jsonb) from (
 select s.event_id,s.source,count(*)::text sale_rows,sum(s.quantity)::text quantity,sum(s.gross_cents)::text gross_cents
 from public.admin_ticket_sales s where (p_event is null or s.event_id=p_event)
 group by s.event_id,s.source order by s.event_id,s.source)r;
$$;
revoke all on function public.upt_ticket_sales_summary(uuid) from public,anon;
grant execute on function public.upt_ticket_sales_summary(uuid) to authenticated;

-- Approved/locked records only, fixed end times, and no sensitive national-register data.
create function upt_administration_private.payroll_rows(p_event uuid)
returns table(session_id uuid,event_id uuid,event_name text,user_id uuid,full_name text,timesheet_status text,started_at timestamptz,ended_at timestamptz,gross_seconds numeric,break_seconds numeric,net_seconds numeric)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then raise exception 'Administration required' using errcode='42501'; end if;
 if p_event is null or not exists(select 1 from public.events e where e.id=p_event) then raise exception 'Event unavailable'; end if;
 if exists(
  select 1 from public.work_sessions w join public.timesheets t on t.event_id=w.event_id and t.user_id=w.user_id
  where w.event_id=p_event and t.status in ('approved','locked')
  and (coalesce(w.ended_at,w.end_time) is null or coalesce(w.ended_at,w.end_time)<coalesce(w.started_at,w.start_time)
    or exists(select 1 from public.break_sessions b where b.work_session_id=w.id and (coalesce(b.ended_at,b.end_time) is null
     or coalesce(b.started_at,b.start_time)<coalesce(w.started_at,w.start_time)
     or coalesce(b.ended_at,b.end_time)>coalesce(w.ended_at,w.end_time)
     or coalesce(b.ended_at,b.end_time)<coalesce(b.started_at,b.start_time)))
    or exists(select 1 from public.break_sessions a join public.break_sessions b on a.work_session_id=b.work_session_id and a.id<b.id
     where a.work_session_id=w.id and coalesce(a.started_at,a.start_time)<coalesce(b.ended_at,b.end_time)
      and coalesce(b.started_at,b.start_time)<coalesce(a.ended_at,a.end_time)))
 ) then raise exception 'Approved time records require correction'; end if;
 return query select w.id,w.event_id,e.name,w.user_id,p.full_name,t.status,
  coalesce(w.started_at,w.start_time),coalesce(w.ended_at,w.end_time),
  extract(epoch from(coalesce(w.ended_at,w.end_time)-coalesce(w.started_at,w.start_time))),
  coalesce(b.seconds,0),
  extract(epoch from(coalesce(w.ended_at,w.end_time)-coalesce(w.started_at,w.start_time)))-coalesce(b.seconds,0)
 from public.work_sessions w join public.events e on e.id=w.event_id join public.profiles p on p.id=w.user_id
 join public.timesheets t on t.event_id=w.event_id and t.user_id=w.user_id
 left join lateral (select sum(extract(epoch from(coalesce(s.ended_at,s.end_time)-coalesce(s.started_at,s.start_time)))) seconds from public.break_sessions s where s.work_session_id=w.id)b on true
 where w.event_id=p_event and t.status in ('approved','locked')
 order by w.user_id,coalesce(w.started_at,w.start_time),w.id;
end $$;
revoke all on function upt_administration_private.payroll_rows(uuid) from public,anon;
grant execute on function upt_administration_private.payroll_rows(uuid) to authenticated;
create function public.upt_administration_payroll_rows(p_event uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_rows jsonb;
begin
 select coalesce(jsonb_agg(r),'[]'::jsonb) into v_rows from (select * from upt_administration_private.payroll_rows(p_event) limit 10001)r;
 if jsonb_array_length(v_rows)>10000 then raise exception 'Payroll export exceeds 10000 sessions'; end if;
 return v_rows;
end $$;
revoke all on function public.upt_administration_payroll_rows(uuid) from public,anon;
grant execute on function public.upt_administration_payroll_rows(uuid) to authenticated;
notify pgrst,'reload schema';

-- Complete operational intake without broadening final approval rights.
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='timesheets' and policyname='timesheets_administration_read') then
  create policy timesheets_administration_read on public.timesheets for select to authenticated using ((select public.upt_can_manage_administration()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='inventory_items' and policyname='inventory_items_administration_read') then
  create policy inventory_items_administration_read on public.inventory_items for select to authenticated using ((select public.upt_can_manage_administration()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='inventory_movements' and policyname='inventory_movements_administration_read') then
  create policy inventory_movements_administration_read on public.inventory_movements for select to authenticated using ((select public.upt_can_manage_administration()));
 end if;
end $$;

create table public.admin_inventory_receipts(
 request_id uuid primary key,
 line_id uuid not null references public.admin_financial_lines(id),
 item_id uuid not null references public.inventory_items(id),
 quantity integer not null check(quantity between 1 and 100000),
 received_by uuid not null references auth.users(id),
 received_at timestamptz not null default now()
);
create index admin_inventory_receipts_line_idx on public.admin_inventory_receipts(line_id);
create index admin_inventory_receipts_item_idx on public.admin_inventory_receipts(item_id);
create index admin_inventory_receipts_actor_idx on public.admin_inventory_receipts(received_by);
alter table public.admin_inventory_receipts enable row level security;
revoke all on public.admin_inventory_receipts from public,anon,authenticated;
grant select on public.admin_inventory_receipts to authenticated;
create policy admin_inventory_receipts_read on public.admin_inventory_receipts for select to authenticated using ((select public.upt_can_manage_administration()));
create function upt_administration_private.receive_inventory(p_request uuid,p_line uuid,p_item uuid,p_quantity integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_line public.admin_financial_lines;v_doc public.admin_financial_documents;v_item public.inventory_items;v_existing public.admin_inventory_receipts;v_received bigint;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() or not public.upt_is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if p_request is null or p_quantity is null or p_quantity not between 1 and 100000 then raise exception 'Invalid receipt'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into v_existing from public.admin_inventory_receipts where request_id=p_request;
 if found then
  if v_existing.line_id<>p_line or v_existing.item_id<>p_item or v_existing.quantity<>p_quantity then raise exception 'Receipt replay conflict' using errcode='23505'; end if;
  return false;
 end if;
 -- Lock the parent before the line, matching the invoice-edit lock order.
 select * into v_doc from public.admin_financial_documents where id=(select document_id from public.admin_financial_lines where id=p_line) for update;
 if not found or v_doc.kind<>'purchase_invoice' or v_doc.status not in ('approved','issued','paid') then raise exception 'Approved purchase invoice required'; end if;
 select * into v_line from public.admin_financial_lines where id=p_line for update;
 if not found or v_line.document_id<>v_doc.id then raise exception 'Invoice line unavailable'; end if;
 select coalesce(sum(quantity),0) into v_received from public.admin_inventory_receipts where line_id=p_line;
 if v_received+p_quantity>v_line.quantity then raise exception 'Receipt exceeds purchased quantity'; end if;
 select * into v_item from public.inventory_items where id=p_item for update;
 if not found or not v_item.is_active or v_doc.event_id is distinct from v_item.event_id then raise exception 'Inventory must belong to the invoice event'; end if;
 update public.inventory_items set total_quantity=total_quantity+p_quantity,available_quantity=available_quantity+p_quantity,updated_at=now() where id=p_item;
 insert into public.inventory_movements(item_id,event_id,workplace_id,actor_id,movement_type,quantity,notes)
 values(p_item,v_item.event_id,v_item.workplace_id,auth.uid(),'restocked',p_quantity,'Purchase invoice '||v_doc.id::text);
 insert into public.admin_inventory_receipts(request_id,line_id,item_id,quantity,received_by) values(p_request,p_line,p_item,p_quantity,auth.uid());
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'administration.purchase.received','inventory_item',p_item,jsonb_build_object('line_id',p_line,'quantity',p_quantity,'request_id',p_request));
 return true;
end $$;
revoke all on function upt_administration_private.receive_inventory(uuid,uuid,uuid,integer) from public,anon;
grant execute on function upt_administration_private.receive_inventory(uuid,uuid,uuid,integer) to authenticated;
create function public.upt_receive_invoice_inventory(p_request uuid,p_line uuid,p_item uuid,p_quantity integer)
returns boolean language sql security invoker set search_path='' as $$ select upt_administration_private.receive_inventory(p_request,p_line,p_item,p_quantity); $$;
revoke all on function public.upt_receive_invoice_inventory(uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.upt_receive_invoice_inventory(uuid,uuid,uuid,integer) to authenticated;

create table public.admin_operational_obligations(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('logistics','permits','tasks')),
 event_id uuid references public.events(id),
 title text not null check(length(btrim(title)) between 3 and 180),
 details text not null default '' check(length(details)<=4000),
 due_at timestamptz not null check(isfinite(due_at)),
 status text not null default 'open' check(status in ('open','submitted','approved','rejected','completed','cancelled')),
 review_note text not null default '' check(length(review_note)<=2000),
 created_by uuid not null default auth.uid() references auth.users(id),
 approved_by uuid references auth.users(id),approved_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((approved_by is null)=(approved_at is null)),
 check(approved_by is null or approved_by<>created_by)
);
create index admin_obligations_event_idx on public.admin_operational_obligations(event_id);
create index admin_obligations_creator_idx on public.admin_operational_obligations(created_by);
create index admin_obligations_approver_idx on public.admin_operational_obligations(approved_by);
create index admin_obligations_due_idx on public.admin_operational_obligations(due_at) where status not in ('completed','cancelled');
alter table public.admin_operational_obligations enable row level security;
revoke all on public.admin_operational_obligations from public,anon,authenticated;
grant select,insert,update on public.admin_operational_obligations to authenticated;
create policy admin_obligations_read on public.admin_operational_obligations for select to authenticated using((select public.upt_can_manage_administration()));
create policy admin_obligations_insert on public.admin_operational_obligations for insert to authenticated with check((select public.upt_can_manage_administration()) and created_by=(select auth.uid()) and status='open' and approved_by is null and approved_at is null);
create policy admin_obligations_update on public.admin_operational_obligations for update to authenticated using((select public.upt_can_manage_administration())) with check((select public.upt_can_manage_administration()));
create function public.upt_guard_administration_obligation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.id is distinct from old.id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
 or new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at then raise exception 'Obligation identity and approval are immutable'; end if;
 if (old.status not in ('open','rejected') or old.status<>new.status) and (new.title is distinct from old.title or new.kind is distinct from old.kind or new.event_id is distinct from old.event_id or new.details is distinct from old.details or new.due_at is distinct from old.due_at) then raise exception 'Submitted obligation content is immutable'; end if;
 if new.status<>old.status then
  if not ((old.status in ('open','rejected') and new.status='submitted') or(old.status='submitted' and new.status in ('approved','rejected')) or(old.status='approved' and new.status='completed') or(old.status not in ('completed','cancelled') and new.status='cancelled')) then raise exception 'Invalid obligation transition'; end if;
  if new.status in ('approved','rejected','cancelled') and not public.upt_is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if new.status='approved' then
   if old.created_by=auth.uid() then raise exception 'Independent Admin approval required'; end if;
   new.approved_by:=auth.uid();new.approved_at:=now();
  end if;
  if new.status='rejected' and length(btrim(new.review_note))<3 then raise exception 'Rejection reason required'; end if;
 end if;
 if new.review_note is distinct from old.review_note and not(old.status='submitted' and new.status='rejected' and public.upt_is_admin()) then raise exception 'Only Admin may record a rejection reason'; end if;
 new.updated_at:=now();return new;
end $$;
create trigger upt_guard_administration_obligation before update on public.admin_operational_obligations for each row execute function public.upt_guard_administration_obligation();
revoke all on function public.upt_guard_administration_obligation() from public,anon,authenticated;

create function upt_administration_private.audit_obligation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'administration.obligation.'||lower(tg_op),'administration_obligation',new.id,
 jsonb_build_object('kind',new.kind,'status',new.status,'previous_status',case when tg_op='UPDATE' then old.status else null end,'due_at',new.due_at));
 return new;
end $$;
revoke all on function upt_administration_private.audit_obligation() from public,anon,authenticated;
create trigger upt_audit_administration_obligation after insert or update on public.admin_operational_obligations for each row execute function upt_administration_private.audit_obligation();

create table public.admin_obligation_notifications(
 obligation_id uuid not null references public.admin_operational_obligations(id),
 user_id uuid not null references auth.users(id),due_at timestamptz not null,
 delivered_at timestamptz not null default now(),primary key(obligation_id,user_id,due_at)
);
create index admin_obligation_notifications_user_idx on public.admin_obligation_notifications(user_id);
alter table public.admin_obligation_notifications enable row level security;
revoke all on public.admin_obligation_notifications from public,anon,authenticated;
create table public.admin_automation_runs(
 id uuid primary key default gen_random_uuid(),completed_at timestamptz not null default now(),
 delivered integer not null default 0,error_code text
);
alter table public.admin_automation_runs enable row level security;
revoke all on public.admin_automation_runs from public,anon,authenticated;
grant select on public.admin_automation_runs to authenticated;
create policy admin_automation_runs_read on public.admin_automation_runs for select to authenticated using((select public.upt_can_manage_administration()));
create function upt_administration_private.run_deadline_notifications()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer:=0;v_row record;v_locale text;
begin
 begin
  for v_row in
   insert into public.admin_obligation_notifications(obligation_id,user_id,due_at)
   select o.id,p.id,o.due_at from public.admin_operational_obligations o cross join public.profiles p
   where o.status not in ('completed','cancelled') and o.due_at<=now() and p.approved and not p.account_blocked
    and not exists(select 1 from public.admin_obligation_notifications n where n.obligation_id=o.id and n.user_id=p.id and n.due_at=o.due_at)
    and (p.role='admin' or exists(select 1 from public.portal_role_assignments a where a.user_id=p.id and a.portal='administration' and a.role='administrative_staff' and a.approved and a.revoked_at is null))
   order by o.due_at,o.id,p.id limit 500
   on conflict do nothing returning obligation_id,user_id
  loop
   select locale into v_locale from public.push_subscriptions where user_id=v_row.user_id order by updated_at desc limit 1;
   insert into public.crew_notifications(user_id,title,body,link,kind)
   select v_row.user_id,
    case v_locale when 'fr' then 'Échéance administrative' when 'en' then 'Administration deadline' when 'de' then 'Verwaltungsfrist' else 'Administratieve deadline' end,
    o.title,'/portals/administration/modules/'||o.kind,'administration_deadline'
   from public.admin_operational_obligations o where o.id=v_row.obligation_id;
   v_count:=v_count+1;
  end loop;
  if v_count>0 then insert into public.admin_automation_runs(delivered) values(v_count);end if;
 exception when others then
  insert into public.admin_automation_runs(error_code) values(sqlstate);
  return -1;
 end;
 return v_count;
end $$;
revoke all on function upt_administration_private.run_deadline_notifications() from public,anon,authenticated;
select cron.schedule('uptilldawn-administration-deadlines','* * * * *','select upt_administration_private.run_deadline_notifications()');
create function public.upt_administration_finance_summary()
returns jsonb language sql stable security invoker set search_path='' as $$
 with p as(select document_id,sum(amount)*100 paid from public.admin_financial_payments group by document_id),
 c as(select original_invoice_id,sum(gross_amount)*100 credited from public.admin_financial_documents where kind='credit_note' and status in ('approved','issued','paid') group by original_invoice_id),
 invoices as(select d.id,d.gross_amount*100 gross,coalesce(p.paid,0) paid,coalesce(c.credited,0) credited
 from public.admin_financial_documents d left join p on p.document_id=d.id left join c on c.original_invoice_id=d.id
 where d.kind in ('sales_invoice','purchase_invoice') and d.status in ('approved','issued','paid') and d.currency='EUR')
 select jsonb_build_object('invoices',count(*)::text,
 'unpaid',(count(*) filter(where paid+credited=0 and gross>0))::text,
 'partial',(count(*) filter(where paid+credited>0 and paid+credited<gross))::text,
 'settled',(count(*) filter(where paid+credited=gross))::text,
 'overpaid',(count(*) filter(where paid+credited>gross))::text,
 'outstanding_cents',coalesce(sum(greatest(0,gross-paid-credited)),0)::bigint::text) from invoices;
$$;
revoke all on function public.upt_administration_finance_summary() from public,anon;
grant execute on function public.upt_administration_finance_summary() to authenticated;
notify pgrst,'reload schema';

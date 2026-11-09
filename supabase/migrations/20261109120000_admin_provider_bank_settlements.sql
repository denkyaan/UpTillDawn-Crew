-- Imported bank and provider CSV entries remain claims until manually reviewed.
create table if not exists public.admin_provider_bank_settlements (
 id uuid primary key default gen_random_uuid(),
 bank_statement_id uuid not null unique references public.admin_bank_statement_transactions(id) on delete restrict,
 provider text not null check (provider in ('eventix','sumup')),
 event_id uuid not null references public.events(id) on delete restrict,
 gross_cents bigint not null check (gross_cents>0 and gross_cents<=99999999999),
 fee_cents bigint not null check (fee_cents>=0 and fee_cents<gross_cents),
 payout_cents bigint not null check (payout_cents=gross_cents-fee_cents and payout_cents>0),
 note text not null check (length(btrim(note)) between 10 and 500),
 approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now()
);
create table if not exists public.admin_provider_bank_settlement_items (
 settlement_id uuid not null references public.admin_provider_bank_settlements(id) on delete restrict,
 provider_transaction_id uuid not null unique references public.admin_provider_transactions(id) on delete restrict,
 signed_cents bigint not null check (signed_cents<>0),
 primary key(settlement_id,provider_transaction_id)
);
create index if not exists admin_provider_bank_settlements_event_idx on public.admin_provider_bank_settlements(event_id,approved_at desc);
create index if not exists admin_provider_bank_settlement_items_settlement_idx on public.admin_provider_bank_settlement_items(settlement_id);
alter table public.admin_provider_bank_settlements enable row level security;
alter table public.admin_provider_bank_settlement_items enable row level security;
revoke all on public.admin_provider_bank_settlements,public.admin_provider_bank_settlement_items from public,anon,authenticated;
grant select on public.admin_provider_bank_settlements,public.admin_provider_bank_settlement_items to authenticated;
drop policy if exists admin_provider_bank_settlements_read on public.admin_provider_bank_settlements;
create policy admin_provider_bank_settlements_read on public.admin_provider_bank_settlements for select to authenticated using (public.upt_can_manage_administration());
drop policy if exists admin_provider_bank_settlement_items_read on public.admin_provider_bank_settlement_items;
create policy admin_provider_bank_settlement_items_read on public.admin_provider_bank_settlement_items for select to authenticated using (public.upt_can_manage_administration());

-- Mutually exclusive with invoice payment posting or ignoring a bank statement.
create or replace function upt_private.prevent_resolving_provider_settled_bank_row()
returns trigger language plpgsql security definer set search_path='pg_catalog' as $$
begin
 if exists (select 1 from public.admin_provider_bank_settlements s where s.bank_statement_id=old.id)
 and (new.posted_payment_id is distinct from old.posted_payment_id
   or new.ignored_at is distinct from old.ignored_at
   or new.linked_document_id is distinct from old.linked_document_id)
 then raise exception 'Provider-settled bank row cannot be posted or ignored' using errcode='23505'; end if;
 return new;
end;
$$;
revoke all on function upt_private.prevent_resolving_provider_settled_bank_row() from public,anon,authenticated;
drop trigger if exists upt_guard_provider_settled_bank_row on public.admin_bank_statement_transactions;
create trigger upt_guard_provider_settled_bank_row before update
on public.admin_bank_statement_transactions for each row
execute function upt_private.prevent_resolving_provider_settled_bank_row();

-- Serialized, immutable, audited manual settlement; never posts an invoice,
-- modifies sales totals, changes stock, or executes an actual bank payment.
create or replace function public.upt_admin_settle_provider_bank_statement(
 p_statement uuid,p_transactions uuid[],p_fee_cents bigint,p_note text
) returns jsonb
language plpgsql security definer set search_path='pg_catalog' as $$
declare
 v_actor uuid:=auth.uid();
 v_bank public.admin_bank_statement_transactions%rowtype;
 v_row public.admin_provider_transactions%rowtype;
 v_provider text;
 v_event uuid;
 v_count integer:=0;
 v_net bigint:=0;
 v_fee bigint:=coalesce(p_fee_cents,-1);
 v_id uuid;
begin
 if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor)
 then raise exception 'Admin required' using errcode='42501'; end if;
 if p_statement is null or p_transactions is null or cardinality(p_transactions) not between 1 and 500
   or array_position(p_transactions,null) is not null
   or (select count(distinct id) from unnest(p_transactions) as id)<>cardinality(p_transactions)
   or v_fee<0 or v_fee>99999999999
   or p_note is null or length(btrim(p_note)) not between 10 and 500
 then raise exception 'Invalid settlement request' using errcode='22023'; end if;
 select * into v_bank from public.admin_bank_statement_transactions
 where id=p_statement for update;
 if not found or v_bank.direction<>'credit' or v_bank.currency<>'EUR'
  or v_bank.posted_payment_id is not null or v_bank.ignored_at is not null
  or exists(select 1 from public.admin_provider_bank_settlements where bank_statement_id=p_statement)
 then raise exception 'Bank statement not eligible' using errcode='23505'; end if;
 for v_row in select * from public.admin_provider_transactions
  where id=any(p_transactions) order by id for update
 loop
  if v_row.status not in ('paid','refunded') or v_row.currency<>'EUR'
   then raise exception 'Pending or invalid provider row' using errcode='22023'; end if;
  if v_provider is null then v_provider:=v_row.provider;v_event:=v_row.event_id;
  elsif v_provider<>v_row.provider or v_event<>v_row.event_id
   then raise exception 'Provider and event must match' using errcode='22023'; end if;
  if exists(select 1 from public.admin_provider_bank_settlement_items i where i.provider_transaction_id=v_row.id)
   then raise exception 'Provider transaction already reconciled' using errcode='23505'; end if;
  v_count:=v_count+1;
  v_net:=v_net+(case when v_row.status='refunded' then -v_row.amount_cents else v_row.amount_cents end);
 end loop;
 if v_count<>cardinality(p_transactions) or v_net<=0 or v_net>99999999999
   or v_fee>=v_net or v_bank.amount_cents<>v_net-v_fee
 then raise exception 'Settlement does not balance' using errcode='22023'; end if;
 insert into public.admin_provider_bank_settlements(
  bank_statement_id,provider,event_id,gross_cents,fee_cents,payout_cents,note,approved_by
 ) values (p_statement,v_provider,v_event,v_net,v_fee,v_bank.amount_cents,btrim(p_note),v_actor)
 returning id into v_id;
 insert into public.admin_provider_bank_settlement_items(settlement_id,provider_transaction_id,signed_cents)
 select v_id,t.id,case when t.status='refunded' then -t.amount_cents else t.amount_cents end
 from public.admin_provider_transactions t where t.id=any(p_transactions);
 if (select count(*) from public.admin_provider_bank_settlement_items where settlement_id=v_id)<>v_count
 then raise exception 'Incomplete settlement' using errcode='22023'; end if;
 return jsonb_build_object('id',v_id,'provider',v_provider,'eventId',v_event,
  'providerNetCents',v_net,'feeCents',v_fee,'payoutCents',v_bank.amount_cents,'transactions',v_count);
end;
$$;
revoke all on function public.upt_admin_settle_provider_bank_statement(uuid,uuid[],bigint,text)
 from public,anon,authenticated;
grant execute on function public.upt_admin_settle_provider_bank_statement(uuid,uuid[],bigint,text)
 to authenticated;
comment on function public.upt_admin_settle_provider_bank_statement(uuid,uuid[],bigint,text)
 is 'Admin-attested matching of imported provider transactions to an imported EUR bank credit; no accounting posting or payout execution.';

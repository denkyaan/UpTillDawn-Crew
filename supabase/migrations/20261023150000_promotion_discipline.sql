-- Promotion strikes and scoped suspensions. Only trusted admin RPCs may record violations.
create table if not exists public.promotion_discipline (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 strikes integer not null default 0 check (strikes between 0 and 2),
 suspension_count integer not null default 0 check (suspension_count between 0 and 2),
 blocked_until timestamptz,
 permanently_blocked boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.promotion_violations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 task_assignment_id uuid references public.task_assignments(id) on delete set null,
 reason text not null check (reason in ('missed_deadline','invalid_evidence')),
 details text not null,
 recorded_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create unique index if not exists promotion_violations_assignment_reason_unique
 on public.promotion_violations(task_assignment_id,reason) where task_assignment_id is not null;
create index if not exists promotion_violations_user_idx on public.promotion_violations(user_id,created_at desc);
alter table public.promotion_discipline enable row level security;
alter table public.promotion_violations enable row level security;
revoke all on public.promotion_discipline, public.promotion_violations from anon,authenticated;
grant select on public.promotion_discipline,public.promotion_violations to authenticated;
create policy promotion_discipline_own_read on public.promotion_discipline for select to authenticated
 using(user_id=(select auth.uid()) or public.upt_is_admin());
create policy promotion_violations_own_read on public.promotion_violations for select to authenticated
 using(user_id=(select auth.uid()) or public.upt_is_admin());

create or replace function public.upt_promotion_is_blocked(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.promotion_discipline d where d.user_id=p_user
 and (d.permanently_blocked or d.blocked_until>now()))
$$;
revoke all on function public.upt_promotion_is_blocked(uuid) from public,anon;
grant execute on function public.upt_promotion_is_blocked(uuid) to authenticated;

create or replace function public.upt_admin_record_promotion_violation(
 p_user uuid,p_assignment uuid,p_reason text,p_details text
) returns integer language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_row public.promotion_discipline%rowtype;v_strikes integer;
begin
 if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and role='admin' and approved and not account_blocked)
 then raise exception 'Admin required' using errcode='42501';end if;
 if p_reason not in ('missed_deadline','invalid_evidence') or length(trim(coalesce(p_details,'')))<10
 then raise exception 'Specific violation evidence required' using errcode='22023';end if;
 if p_assignment is null or not exists(select 1 from public.task_assignments where id=p_assignment and user_id=p_user)
 then raise exception 'Assignment does not belong to user' using errcode='22023';end if;
 insert into public.promotion_discipline(user_id) values(p_user) on conflict do nothing;
 select * into v_row from public.promotion_discipline where user_id=p_user for update;
 if v_row.permanently_blocked or v_row.blocked_until>now()
 then raise exception 'Promotion account already blocked' using errcode='22023';end if;
 insert into public.promotion_violations(user_id,task_assignment_id,reason,details,recorded_by)
 values(p_user,p_assignment,p_reason,trim(p_details),v_actor);
 v_strikes:=v_row.strikes+1;
 if v_strikes>=3 then
  update public.promotion_discipline set strikes=0,suspension_count=least(suspension_count+1,2),
   blocked_until=case when suspension_count=0 then now()+interval '1 month' else null end,
   permanently_blocked=(suspension_count>=1),updated_at=now() where user_id=p_user;
 else
  update public.promotion_discipline set strikes=v_strikes,updated_at=now() where user_id=p_user;
 end if;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'promotion_violation','task_assignment',p_assignment,
 jsonb_build_object('user_id',p_user,'reason',p_reason,'strike',v_strikes));
 return v_strikes;
end;$$;
revoke all on function public.upt_admin_record_promotion_violation(uuid,uuid,text,text) from public,anon;
grant execute on function public.upt_admin_record_promotion_violation(uuid,uuid,text,text) to authenticated;

create or replace function public.upt_admin_unblock_promotion(p_user uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and role='admin' and approved and not account_blocked)
 then raise exception 'Admin required' using errcode='42501';end if;
 if length(trim(coalesce(p_reason,'')))<10 then raise exception 'Reason required' using errcode='22023';end if;
 update public.promotion_discipline set strikes=0,blocked_until=null,permanently_blocked=false,
 suspension_count=0,updated_at=now() where user_id=p_user;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'promotion_unblocked','profile',p_user,jsonb_build_object('reason',trim(p_reason)));
end;$$;
revoke all on function public.upt_admin_unblock_promotion(uuid,text) from public,anon;
grant execute on function public.upt_admin_unblock_promotion(uuid,text) to authenticated;

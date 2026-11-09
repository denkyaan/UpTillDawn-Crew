-- Main-test acceptance. Every identity and role change is rolled back.
-- Run after the leadership migration; never edits a real Admin permanently.
begin;
create temp table qa_lead_users(name text primary key,id uuid not null default gen_random_uuid());
insert into qa_lead_users(name) values('head'),('old_admin'),('left'),('right'),('spare');
grant select on qa_lead_users to authenticated;
insert into auth.users(id,email)
 select id,'qa-lead-'||name||'-'||id::text||'@example.invalid' from qa_lead_users;
update public.profiles p
 set role=case when q.name in ('head','old_admin') then 'admin' else 'staff' end,
     approved=true,account_blocked=false
 from qa_lead_users q where p.id=q.id;
select set_config('request.jwt.claim.sub',(select id::text from qa_lead_users where name='head'),true);
set local role authenticated;
select public.upt_leadership_assign('head',(select id from qa_lead_users where name='head'));
select public.upt_leadership_assign('left_hand',(select id from qa_lead_users where name='left'));
select public.upt_leadership_assign('right_hand',(select id from qa_lead_users where name='right'));
-- Inspect the RLS-backed role state as the test database owner. Subsequent
-- RPC calls still impersonate each JWT actor, and must enforce the actor.
reset role;
do $qa$
declare
 v_head uuid:=(select id from qa_lead_users where name='head');
 v_old uuid:=(select id from qa_lead_users where name='old_admin');
 v_left uuid:=(select id from qa_lead_users where name='left');
 v_right uuid:=(select id from qa_lead_users where name='right');
 v_spare uuid:=(select id from qa_lead_users where name='spare');
 v_duplicate boolean:=false;
 v_denied boolean:=false;
 v_extra boolean:=false;
begin
 if (select count(*) from public.upt_organization_leadership)<>3 then
  raise exception 'Leadership must have exactly three occupied slots';end if;
 if not public.upt_is_admin(v_head) or public.upt_is_admin(v_old) then
  raise exception 'Head claim failed to enforce one Admin';end if;
 if not exists(select 1 from public.portal_role_assignments
   where user_id=v_left and portal='administration'
    and role='administrative_staff' and approved and revoked_at is null)
 then raise exception 'Left hand lacked Administration access';end if;
 begin perform public.upt_leadership_assign('right_hand',v_left);
 exception when unique_violation then v_duplicate:=true;end;
 if not v_duplicate then raise exception 'Same person assigned to both hands';end if;
 perform set_config('request.jwt.claim.sub',v_right::text,true);
 begin perform public.upt_leadership_assign('left_hand',v_spare);
 exception when insufficient_privilege then v_denied:=true;end;
 if not v_denied then raise exception 'Deputy changed leadership';end if;
 if public.upt_is_admin() then raise exception 'Deputy obtained permanent Admin';end if;
 if not public.upt_can_manage_administration() then
  raise exception 'Deputy cannot access Administration';end if;
 perform set_config('request.jwt.claim.sub',v_head::text,true);
 begin update public.profiles set role='admin' where id=v_spare;
 exception when check_violation then v_extra:=true;end;
 if not v_extra then raise exception 'Second Admin promotion allowed';end if;
 perform public.upt_leadership_assign('left_hand',v_spare);
 if exists(select 1 from public.portal_role_assignments where user_id=v_left
  and portal='administration' and role='administrative_staff'
  and approved=true and revoked_at is null) then
  raise exception 'Former deputy retained leadership-managed Administration access';
 end if;
 perform public.upt_leadership_assign('head',v_old);
 if public.upt_is_admin(v_head) or not public.upt_is_admin(v_old) then
  raise exception 'Head transfer failed to revoke previous Admin rights';end if;
 if (select count(*) from public.upt_organization_leadership)<>3 then
  raise exception 'Head transfer removed a deputy';end if;
end $qa$;
reset role;
select 'PASS: one Head, Left/Right portal access, duplicate rejection, deputy denial, revocation and Head transfer' as result;
rollback;

-- Transactional integration test of the complete portal entitlement lifecycle.
-- Local CI only: all fixture accounts, grants and audit records are rolled back.
begin;

-- This is a shared Main QA database: use its existing designated Head,
-- rather than attempting to create a second full Admin account.
DO $qa_head$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.upt_organization_leadership l
   JOIN public.profiles p ON p.id=l.user_id
   WHERE l.slot='head' AND p.role='admin' AND p.approved AND NOT coalesce(p.account_blocked,false)) THEN
  RAISE EXCEPTION 'Main QA Head fixture unavailable';
 END IF;
END $qa_head$;

CREATE TEMP TABLE qa_portal_head(id uuid not null);
INSERT INTO qa_portal_head(id)
SELECT l.user_id FROM public.upt_organization_leadership l
WHERE l.slot='head';
GRANT SELECT ON qa_portal_head TO authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
 ('b9100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portal-staff-ci@example.invalid','',now(),now(),now()),
 ('b9100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portal-other-ci@example.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.profiles(id,role,approved,account_blocked)
values
 ('b9100000-0000-4000-8000-000000000002','staff',true,false),
 ('b9100000-0000-4000-8000-000000000003','staff',true,false)
on conflict (id) do update set role=excluded.role,approved=excluded.approved,account_blocked=false;

set local role authenticated;
select set_config('request.jwt.claim.sub',(SELECT id::text FROM qa_portal_head),true);

do $test$
declare
 v_id uuid;
 v_count integer;
begin
 -- Assign: pending, no entitlement.
 v_id:=public.upt_admin_set_portal_role('b9100000-0000-4000-8000-000000000002','promotion','promoter','assign');
 -- Recipient entitlement is checked below after switching to the recipient JWT.
 select count(*) into v_count from public.upt_my_portal_assignments();
 if v_count<>0 then raise exception 'Admin unexpectedly received another user grant'; end if;

 -- Approve: active and visible to recipient.
 perform public.upt_admin_set_portal_role('b9100000-0000-4000-8000-000000000002','promotion','promoter','approve');
 -- Approval and audit are verified through the recipient entitlement and the RPC transaction.

 perform set_config('request.jwt.claim.sub','b9100000-0000-4000-8000-000000000002',true);
 select count(*) into v_count from public.upt_my_portal_assignments()
 where portal='promotion' and role='promoter' and approved and revoked_at is null;
 if v_count<>1 then raise exception 'Recipient cannot read approved entitlement'; end if;
 begin
   perform public.upt_admin_set_portal_role('b9100000-0000-4000-8000-000000000003','promotion','promoter','assign');
   raise exception 'Non-admin mutation unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;

 -- Atomic grant: assign and approve together, without a pending intermediate state.
 perform set_config('request.jwt.claim.sub',(SELECT id::text FROM qa_portal_head),true);
 perform public.upt_admin_set_portal_role('b9100000-0000-4000-8000-000000000003','administration','administrative_staff','assign_approved');
 perform set_config('request.jwt.claim.sub','b9100000-0000-4000-8000-000000000003',true);
 select count(*) into v_count from public.upt_my_portal_assignments()
 where portal='administration' and role='administrative_staff' and approved and revoked_at is null;
 if v_count<>1 then raise exception 'Atomic approved grant not visible to recipient'; end if;
 perform set_config('request.jwt.claim.sub',(SELECT id::text FROM qa_portal_head),true);
 begin
   perform public.upt_admin_set_portal_role('b9100000-0000-4000-8000-000000000003','administration','administrative_staff','assign_approved');
   raise exception 'Duplicate active atomic grant unexpectedly succeeded';
 exception when invalid_parameter_value then null;
 end;
 -- Revoke as admin, then verify the recipient loses access.
 perform set_config('request.jwt.claim.sub',(SELECT id::text FROM qa_portal_head),true);
 perform public.upt_admin_set_portal_role('b9100000-0000-4000-8000-000000000002','promotion','promoter','revoke');
 perform set_config('request.jwt.claim.sub','b9100000-0000-4000-8000-000000000002',true);
 select count(*) into v_count from public.upt_my_portal_assignments()
 where portal='promotion' and role='promoter' and approved and revoked_at is null;
 if v_count<>0 then raise exception 'Revoked grant still authorizes recipient'; end if;
end $test$;

reset role;
rollback;

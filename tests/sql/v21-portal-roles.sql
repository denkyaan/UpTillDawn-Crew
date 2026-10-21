-- V2.1 portal entitlements must remain private, unapproved by default,
-- and unavailable for mutation by ordinary authenticated users.
begin;
select plan(9);

select has_table('public','portal_role_assignments','Portal grants table exists');
select has_column('public','portal_role_assignments','revoked_at','Revocation is tracked');
select has_function('public','upt_my_portal_assignments',array[]::text[],'Self-service entitlement RPC exists');
select results_eq(
  $$select relrowsecurity from pg_class where oid='public.portal_role_assignments'::regclass$$,
  $$values(true)$$,
  'RLS is enabled'
);
select results_eq(
  $$select count(*)::integer from pg_policies where schemaname='public' and tablename='portal_role_assignments' and cmd in ('INSERT','UPDATE','DELETE','ALL')$$,
  $$values(0)$$,
  'No permissive mutation policies exist'
);
select results_eq(
  $$select has_table_privilege('authenticated','public.portal_role_assignments','INSERT')$$,
  $$values(false)$$,
  'Authenticated cannot insert portal grants'
);
select results_eq(
  $$select has_table_privilege('authenticated','public.portal_role_assignments','UPDATE')$$,
  $$values(false)$$,
  'Authenticated cannot update portal grants'
);
select results_eq(
  $$select has_table_privilege('authenticated','public.portal_role_assignments','DELETE')$$,
  $$values(false)$$,
  'Authenticated cannot delete portal grants'
);
select results_eq(
  $$select prosecdef from pg_proc where oid='public.upt_my_portal_assignments()'::regprocedure$$,
  $$values(false)$$,
  'Entitlement RPC does not bypass RLS'
);
select * from finish();
rollback;

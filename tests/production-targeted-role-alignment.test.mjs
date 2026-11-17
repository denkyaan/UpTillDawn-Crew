import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const upgrade=read('supabase/upgrades/production-role-administration-alignment-20261117.sql')
const preflight=read('scripts/production-preflight-readonly.sql')
const mainDraft=read('supabase/migrations/20261112215746_administration_event_draft_workflow.sql')
const mainOwner=read('supabase/migrations/20261112195755_maker_owner_effective_role_mode_fix.sql')

test('Production repair is atomic and guarded; never an automatic Main migration',()=>{
 assert.ok(upgrade.includes('BEGIN;')&&upgrade.includes('COMMIT;'))
 assert.ok(upgrade.includes("SET LOCAL lock_timeout='5s'"))
 assert.ok(upgrade.includes("SET LOCAL statement_timeout='30s'"))
 for(const marker of ['supabase_migrations.schema_migrations','20261112062000','8ec846af135d9ac695a6fb73a129ccfa','Existing required Production dependencies missing','Production effective-role function changed: new review required','Event draft function already exists: inspect before replacing'])
  assert.ok(upgrade.includes(marker),marker)
 assert.ok(upgrade.indexOf('$upt_prod_precheck$;')<upgrade.indexOf('CREATE OR REPLACE FUNCTION public.upt_administration_save_event_draft'))
 assert.ok(upgrade.indexOf('$upt_prod_postcheck$;')>upgrade.indexOf('REVOKE ALL ON FUNCTION public.upt_current_effective_role'))
 const outside=upgrade.replace(/\$upt_event_draft\$[\s\S]*?\$upt_event_draft\$/g,'BODY')
  .replace(/\$upt_owner_mode\$[\s\S]*?\$upt_owner_mode\$/g,'BODY')
  .replace(/--[^\n]*/g,'')
 assert.doesNotMatch(outside,/\b(?:INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|DROP\s+TABLE|TRUNCATE|ALTER\s+TABLE|CREATE\s+TABLE|ALTER\s+ROLE|CREATE\s+ROLE)\b/i)
 assert.doesNotMatch(upgrade,/\b(?:wrangler deploy|npm run deploy|supabase db reset)\b/i)
})

test('Prepared RPC definitions match Main authorization and draft-only contracts',()=>{
 for(const clause of [
  'public.upt_is_admin(v_actor)',
  'public.portal_role_assignments a ON a.user_id=p.id',
  'p.approved IS TRUE',
  'coalesce(p.account_blocked,false)=false',
  "a.portal='administration'",
  "a.role='administrative_staff'",
  'a.approved IS TRUE AND a.revoked_at IS NULL',
  "e.status='draft'",
  'e.created_by=v_actor OR public.upt_is_admin(v_actor)',
  'p_end_at<=p_start_at',
 ]){assert.ok(upgrade.includes(clause),'Production draft missing '+clause)
    assert.ok(mainDraft.includes(clause),'Main draft missing '+clause)}
 for(const clause of [
  'upt_private.is_app_owner(auth.uid())',
  'public.admin_role_modes',
  'public.upt_effective_role(auth.uid())',
  "'admin','staff','responsible_lead'",
 ]){assert.ok(upgrade.includes(clause),'Production Maker missing '+clause)
    assert.ok(mainOwner.includes(clause),'Main Maker missing '+clause)}
 assert.match(upgrade,/WHEN auth\.uid\(\) IS NULL THEN NULL/)
 assert.match(mainOwner,/when auth\.uid\(\) is null then null/)
 assert.equal((upgrade.match(/CREATE OR REPLACE FUNCTION/g)??[]).length,2)
 assert.doesNotMatch(upgrade,/CREATE OR REPLACE FUNCTION public\.upt_set_admin_role_mode/)
})

test('SECURITY DEFINER functions deny public/anon, permit authenticated and re-check ACL',()=>{
 for(const signature of [
  'public.upt_current_effective_role()',
  'public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)',
 ]) {
  assert.ok(upgrade.includes('REVOKE ALL ON FUNCTION '+signature))
  assert.ok(upgrade.includes('GRANT EXECUTE ON FUNCTION '+signature))
 }
 assert.match(upgrade,/FROM PUBLIC, anon, authenticated;/)
 assert.match(upgrade,/TO authenticated;/)
 assert.match(upgrade,/has_function_privilege\('anon'/)
 assert.match(upgrade,/has_function_privilege\('authenticated'/)
 assert.match(upgrade,/pg_notify\('pgrst','reload schema'\)/)
})

test('Metadata-only preflight blocks unsafe roles without treating historical migrations as an automatic failure',()=>{
 for(const key of [
  'administration_event_draft_rpc','draft_rpc_checks_approval_and_revocation',
  'draft_rpc_rejects_unauthenticated','owner_mode_is_separate_from_head_admin',
  'owner_mode_rejects_unauthenticated','owner_mode_supports_three_portals',
  'owner_role_mode_setter_present','main_tip_migration_in_history',
  'BLOCK RELEASE'
 ])assert.ok(preflight.includes(key),key)
 assert.match(preflight,/main_tip_migration_in_history', false/)
 const active=preflight.replace(/--[^\n]*/g,'').replace(/'EXECUTE'/g,'privilege')
 assert.doesNotMatch(active,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CREATE|EXECUTE|CALL|DO)\b/i)
})

test('Main workflow never publishes Production and legacy Cloudflare auto-trigger needs separate verification',()=>{
 const deployment=read('DEPLOYMENT.md')
 const main=read('.github/workflows/deploy-main.yml')
 const production=read('.github/workflows/deploy-cloudflare.yml')
 assert.match(deployment,/External Cloudflare build trigger caveat/)
 assert.match(main,/npx wrangler deploy --config wrangler\.main\.jsonc/)
 assert.doesNotMatch(main,/npx wrangler deploy --config wrangler\.alias\.jsonc/)
 assert.match(production,/workflow_dispatch:/)
 assert.match(production,/Require successful full CI for exact release commit/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261110110000_separate_owner_from_leadership_and_directories.sql','utf8')
const qa=readFileSync('tests/sql/owner-leadership-privacy.sql','utf8')
const seed=readFileSync('scripts/seed-local-maker-e2e.mjs','utf8')
const ci=readFileSync('.github/workflows/ci.yml','utf8')

test('Owner is a permanent system identity, not Head Admin or an editable employee',()=>{
 assert.match(migration,/upt_private\.is_app_owner\(p_user\)/)
 assert.match(migration,/Maker\/Owner cannot occupy an operational leadership slot/)
 assert.match(migration,/Maker\/Owner is not an assignable personnel role/)
 assert.match(migration,/DELETE FROM public\.upt_organization_leadership l[\s\S]+USING upt_private\.app_owners o/)
 assert.match(migration,/DELETE FROM public\.upt_personnel_role_slots r/)
 assert.match(migration,/UPDATE public\.profiles p SET role='staff'/)
 assert.match(migration,/p_user is distinct from v_actor and not upt_private\.is_app_owner\(v_actor\)/)
})
test('Owner identity is removed at the database layer, not just hidden by UI styles',()=>{
 for(const rpc of ['upt_admin_personnel_details','upt_admin_personnel_details_v2','upt_crew_directory','upt_promotion_directory','upt_responsible_crew_directory'])
  assert.ok(migration.includes('FUNCTION public.'+rpc+'('),rpc)
 assert.ok((migration.match(/upt_private\.is_app_owner\(p\.id\)/g)||[]).length>=5)
 assert.match(qa,/upt_admin_personnel_details_v2\(\)/)
 assert.match(qa,/upt_crew_directory\(\)/)
 assert.match(qa,/upt_promotion_directory\(\)/)
 assert.match(qa,/current_setting\('upt\.qa_owner_id'\)::uuid/)
 assert.ok(qa.indexOf("set_config('upt.qa_owner_id'")<qa.indexOf('SET LOCAL ROLE authenticated'),'QA owner must be captured before dropping auth.users permissions')
})
test('Six-role acceptance uses only isolated local credentials and no visible app seed',()=>{
 assert.match(seed,/target\.port!=='54321'/)
 assert.match(seed,/role:'staff'/)
 assert.doesNotMatch(seed,/npbjrtiolqperdgljnhi|eakoavcieossazqzplke/)
 assert.match(ci,/scripts\/seed-local-maker-e2e\.mjs/)
 assert.match(ci,/tests\/sql\/owner-leadership-privacy\.sql/)
 assert.match(ci,/npm run e2e:portals/)
 assert.match(ci,/MAKER:bot-16-maker/)
 assert.match(ci,/E2E_\$\{role\}_EMAIL/)
 assert.match(ci,/UPT_E2E_SESSION_BRIDGE/)
})

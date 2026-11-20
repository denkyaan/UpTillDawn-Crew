import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(path,'utf8')

test('Production readiness preflight is metadata-only, pinned to required schema contracts',()=>{
 const source=read('scripts/production-preflight-readonly.sql')
 const active=source.replace(/--[^\n]*/g,'').replace(/'EXECUTE'/g,'privilege')
 assert.doesNotMatch(active,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CREATE|EXECUTE|CALL|DO)\b/i)
 for(const check of [
  'upt_administration_save_event_draft',
  'upt_current_effective_role',
  'upt_administration_timesheet_labels',
  'upt_private.integration_connections',
  'upt_can_manage_integrations',
  'admin_provider_bank_settlements',
 ])assert.ok(source.includes(check),check)
 assert.match(source,/BLOCK RELEASE/)
 assert.match(source,/main_tip_migration_in_history', false/)
 const baseline=read('lib/release-baseline.ts')
 const version=baseline.match(/EXPECTED_DB_MIGRATION_VERSION='(\d+)'/)?.[1]
 assert.ok(version,'Missing versioned database release baseline')
 assert.ok(source.includes("WHERE version='"+version+"'"),'Preflight historical migration marker must match the baseline')
 assert.match(source,/retired_pre_qr_attendance_closed_and_qr_flow_enabled/)
 // Pre-QR entry points must be revoked, while the signed-in QR flow remains callable.
 for(const rpc of ['upt_request_check_in','upt_request_check_out']){
  assert.ok(source.includes(rpc),'Release preflight must check the retired RPC: '+rpc)
 }
 assert.match(source,/NOT has_function_privilege\('authenticated'/)
 assert.match(source,/upt_qr_request\(boolean,boolean,text\)/)
 assert.match(source,/has_function_privilege\('authenticated',[\s\S]*upt_qr_request/)
})
test('Main-only functional E2E uses real signed-in users to verify role-specific chat and a disposable shift/briefing',()=>{
 const e2e=read('scripts/e2e-main-functional-workflows.mjs')
 assert.match(e2e,/Isolated Main only/)
 assert.match(e2e,/if\(base!==MAIN\|\|target!==MAIN_DB/)
 assert.match(e2e,/E2E_MAIN_QA_ALLOW_WRITE!=='1'/)
 assert.match(e2e,/Four operational roles see only permitted standard organization chats/)
 assert.match(e2e,/\.from\('chat_channels'\)/)
 assert.match(e2e,/Head Admin creates a real scheduled workpost and assigned Staff reads its shift/)
 assert.match(e2e,/head\.db\.rpc\('upt_create_shift',shiftArgs\)/)
 assert.match(e2e,/promotion\.db\.rpc\('upt_create_shift',shiftArgs\)/)
 assert.doesNotMatch(e2e,/head\.db\.from\('shifts'\)\.insert\(/)
 assert.doesNotMatch(e2e,/promotion\.db\.from\('shifts'\)\.insert\(/)
 assert.match(e2e,/Head Admin publishes scoped QA briefing and Staff reads the correct briefing/)
 assert.match(e2e,/Promotion cannot forge a Staff shift/)
 for(const table of ['shifts','briefings','workplaces','timesheets','event_members'])
  assert.ok(e2e.includes("await remove('"+table+"'"),table)
 assert.match(e2e,/QA cleanup refused: fixture event ownership changed/)
 assert.match(e2e,/No Maker, production, provider API calls, payments/)
})
test('One encrypted connection store remains role-scoped; failures are never misreported as disconnected',()=>{
 const panel=read('components/admin/external-services-readiness.tsx')+read('lib/administration/external-services-view-data.ts')
 const access=read('lib/administration/integration-management-access.ts')
 const store=read('lib/administration/integration-store.ts')
 const placement=read('lib/administration/integration-placement.ts')
 assert.match(access,/cache\(async function integrationManagementAccess/)
 assert.match(access,/upt_can_manage_integrations/)
 assert.match(store,/upt_integration_credentials/)
 assert.match(panel,/listIntegrationSummaries\(access\.db\)/)
 assert.doesNotMatch(panel,/listIntegrationSummaries\(access\.db\)\.catch\(\(\)=>\[\]\)/)
 assert.match(panel,/access\.ok&&!lookup\.available/)
 assert.match(panel,/labels\.statusUnavailable/)
 assert.match(panel,/data-integration-workspace=\{service\.id\}/)
 assert.match(placement,/banking:\["banking","sumup","eventpay"\]/)
 assert.match(placement,/sales:\["sumup","eventpay"\]/)
 assert.match(placement,/ticketing:\["weeztix","eventix"\]/)
 assert.doesNotMatch(placement,/eventpay:\[/)
})
test('All four locales describe connection lookup outage without revealing credentials',()=>{
 const panel=read('components/admin/external-services-readiness.tsx')+read('lib/administration/external-services-view-data.ts')
 for(const locale of ['nl','fr','en','de'])assert.match(panel,new RegExp(' '+locale+':\\{[^\\n]*statusUnavailable:'))
 assert.doesNotMatch(panel,/JSON\.stringify\(stored\)|console\.log\(stored\)|return.*ciphertext/)
})

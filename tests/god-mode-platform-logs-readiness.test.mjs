import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('Maker platform log endpoint is owner-only, read-only and environment-isolated',async()=>{
 const api=await read('app/api/god/platform-logs/route.ts')
 assert.match(api,/authorizeStudio\(request\)/)
 assert.match(api,/upt_god_database_secret/)
 assert.match(api,/GOD_ENVIRONMENTS\[input\.environment\]\.supabaseProject/)
 assert.match(api,/analytics\/endpoints\/logs/)
 assert.match(api,/iso_timestamp_start/)
 assert.match(api,/iso_timestamp_end/)
 assert.match(api,/redirect:'manual'/)
 assert.match(api,/cache:'no-store'/)
 assert.match(api,/sources\.has\(row\.source\)/)
 assert.doesNotMatch(api,/service_role|NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/)
 assert.doesNotMatch(api,/method:'POST'|method:'PUT'|method:'PATCH'/)
})
test('All four Maker locales can filter Supabase logs independently of stored app errors',async()=>{
 const component=await read('components/god-mode/maker-logs.tsx')
 for(const l of ['nl','fr','en','de'])assert.ok(component.includes(' '+l+':{'),'missing '+l)
 assert.match(component,/platformLogs\.map/)
 assert.match(component,/kind==='platform'/)
 assert.match(component,/platformUnavailable/)
 assert.match(component,/environment='\+environment/)
 assert.match(component,/platform-logs\?environment=/)
 assert.match(component,/onDiagnose/)
})
test('Production schema readiness is fail-closed and surfaced in Maker overview',async()=>{
 const [api,component,contract]=await Promise.all([
  read('app/api/god/overview/route.ts'),
  read('components/god-mode/maker-overview.tsx'),
  read('scripts/production-schema-contract.mjs'),
 ])
 assert.match(api,/releaseSchemaReadiness/)
 assert.match(api,/read_only:true/)
 assert.match(api,/productionSchema:/)
 assert.match(component,/productionSchema\?\.ready===false/)
 assert.match(component,/schemaUnknown/)
 for(const table of ['portal_role_assignments','admin_financial_documents','admin_ticket_sales','admin_provider_event_mappings']){
  assert.ok(api.includes(table),'unverified '+table)
  assert.ok(contract.includes(table),'baseline lacks '+table)
 }
})

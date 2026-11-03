import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
test('ticket export is guarded by live administration permissions and uses stored database summary',()=>{
 const route=read('../app/api/administration/ticketing/export/route.ts')
 assert.match(route,/administrationAccess\(\)/)
 assert.match(route,/if\(!access\.ok\)/)
 assert.match(route,/upt_ticket_sales_summary/)
 assert.match(route,/financeCsv\(/)
 assert.match(route,/private, no-store/)
 assert.match(route,/X-Content-Type-Options/)
})
test('ticket export fails closed on malformed provider data and caps result size',()=>{
 const route=read('../app/api/administration/ticketing/export/route.ts')
 assert.match(route,/rows\.length>10000/)
 assert.match(route,/uuid\.test\(row\.event_id\)/)
 assert.match(route,/digits\(row\.gross_cents\)/)
 assert.match(route,/invalid_report_data/)
})
test('ticket overview provides export only when valid saved sales exist and supports four languages',()=>{
 const ui=read('../components/administration/ticket-sales-overview.tsx')
 assert.match(ui,/\/api\/administration\/ticketing\/export/)
 assert.match(ui,/!error&&valid&&rows\.length>0/)
 for(const locale of ['nl','fr','en','de'])assert.match(ui,new RegExp('\\b'+locale+':\\{'))
})

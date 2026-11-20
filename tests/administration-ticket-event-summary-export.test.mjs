import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
test('event summary CSV is authorized and rejects invalid RPC data',()=>{
 const source=read('../app/api/administration/ticketing/event-summary/route.ts')
 assert.match(source,/administrationAccess\(\)/)
 assert.match(source,/if\(!access\.ok\)/)
 assert.match(source,/validateTicketSalesSummary\(data\)/)
 assert.match(source,/ticketSalesByEvent\(data\)/)
 assert.match(source,/financeCsv\(/)
 assert.match(source,/private, no-store/)
 assert.match(source,/nosniff/)
})
test('event summary export is localized and visible in the ticket overview',()=>{
 const source=read('../components/administration/ticket-sales-overview.tsx')
 assert.match(source,/href="\/api\/administration\/ticketing\/event-summary"/)
 for(const label of ['Evenementenoverzicht CSV','Résumé événements CSV','Event summary CSV','Eventübersicht CSV'])assert.ok(source.includes(label))
})

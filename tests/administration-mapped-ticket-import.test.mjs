import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validateTicketSalesCsv} from '../lib/administration/ticket-import.ts'

const internal='123e4567-e89b-42d3-a456-426614174000'
const external='eventix:festival-23'
const header='external_id,external_event_id,quantity,gross_amount,currency,sold_at\n'
const row=(id='TX-001',event=external)=>id+','+event+',2,34.56,EUR,2026-11-09T20:00:00+01:00\n'

test('mapped provider CSV resolves external IDs to one validated internal event',()=>{
 const result=validateTicketSalesCsv(header+row(),internal,10000,external)
 assert.deepEqual(result.errors,[])
 assert.equal(result.rows.length,1)
 assert.equal(result.rows[0].eventId,internal)
 assert.equal(result.rows[0].externalId,'TX-001')
 assert.equal(result.grossCents,3456)
 assert.equal(result.quantity,2)
 assert.equal(result.rows[0].soldAt,'2026-11-09T19:00:00.000Z')
})
test('mapped import rejects wrong external event, legacy headers and empty/unsafe mapping',()=>{
 for(const csv of [
  header+row('TX-002','another-event'),
  header.replace('external_event_id','event_id')+row(),
  header+row('TX-001')+row('TX-001'),
  header+row('TX-001')+row('TX-003','wrong-event'),
 ]){
  const result=validateTicketSalesCsv(csv,internal,10000,external)
  assert.ok(result.errors.length>0)
  assert.deepEqual(result.rows,[])
  assert.equal(result.quantity,0)
  assert.equal(result.grossCents,0)
 }
 for(const invalid of ['','../../etc','bad name','a'.repeat(161)]){
  const result=validateTicketSalesCsv(header+row(),internal,10000,invalid)
  assert.ok(result.errors.length>0)
  assert.equal(result.rows.length,0)
 }
})
test('legacy manual imports remain unchanged, while mapped CSV requires explicit schema',()=>{
 const legacy='external_id,event_id,quantity,gross_amount,currency,sold_at\n'
 const value='TX-001,'+internal+',2,34.56,EUR,2026-11-09T20:00:00+01:00\n'
 assert.equal(validateTicketSalesCsv(legacy+value,internal).errors.length,0)
 assert.equal(validateTicketSalesCsv(legacy+value,internal,10000,external).rows.length,0)
 assert.equal(validateTicketSalesCsv(header+row(),internal).rows.length,0)
})
test('provider ticket import API requires a fully matching active mapping before RPC',()=>{
 const api=readFileSync(new URL('../app/api/administration/ticketing/import/route.ts',import.meta.url),'utf8')
 assert.match(api,/sameOrigin\(request\)/)
 assert.match(api,/administrationAccess\(\)/)
 assert.match(api,/form\.has\("mappingId"\)\|\|form\.has\("externalEventId"\)/)
 assert.match(api,/admin_provider_event_mappings/)
 for(const column of ['id','provider','external_event_id','event_id','enabled'])
  assert.match(api,new RegExp('\\.eq\\("'+column+'",'))
 assert.match(api,/mapping_inactive_or_mismatch/)
 assert.match(api,/validateTicketSalesCsv\(csv,eventId,10000,mappedAttempt\?externalEventId:undefined\)/)
 assert.match(api,/upt_import_ticket_sales/)
})
test('ticketing page offers mapped CSV workflow without removing manual uploads',()=>{
 const page=readFileSync(new URL('../app/(app)/portals/administration/modules/[slug]/page.tsx',import.meta.url),'utf8')
 assert.match(page,/TicketImportPreview/)
 assert.match(page,/MappedTicketImportPreview/)
 const ui=readFileSync(new URL('../components/administration/mapped-ticket-import-preview.tsx',import.meta.url),'utf8')
 for(const locale of ['nl','fr','en','de'])assert.match(ui,new RegExp('\\b'+locale+':\\{title:'))
 assert.match(ui,/\/api\/administration\/provider-mappings/)
 assert.match(ui,/\/api\/administration\/ticketing\/import/)
 assert.match(ui,/form\.set\("mappingId",selected\.id\)/)
 assert.match(ui,/form\.set\("externalEventId",selected\.external_event_id\)/)
 assert.match(ui,/validateTicketSalesCsv\(csv,selected\.event_id,10000,selected\.external_event_id\)/)
 assert.match(ui,/router\.refresh\(\)/)
})

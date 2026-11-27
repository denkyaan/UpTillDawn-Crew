import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
test('inventory batches signed document queries and preserves exact event/workplace authorization and rendering',()=>{
 const page=readFileSync('app/(app)/inventory/page.tsx','utf8')
 const panel=readFileSync('components/crew/event-documents-panel.tsx','utf8')
 assert.match(page,/loadInventoryDocuments\(visible\)/)
 assert.match(page,/<EventDocumentsView/)
 assert.doesNotMatch(page,/<EventDocumentsPanel/)
 assert.match(panel,/\.in\('workplace_id',ids\)\.eq\('is_active',true\)/)
 assert.match(panel,/byId\.get\(document\.workplace_id\)!==document\.event_id/)
 assert.match(panel,/createSignedUrl\(document\.storage_path,600\)/)
 assert.match(panel,/offset\+=8/)
 assert.match(panel,/\.range\(offset,offset\+249\)/)
 assert.doesNotMatch(panel,/service_role|createPublicUrl/)
})

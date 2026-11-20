import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('draft notes edit validates document and restricts changes to drafts',()=>{
 const a=page.slice(page.indexOf('async function updateDraftNotes('),page.indexOf('async function updateDraftDocumentNumber('))
 assert.match(a,/\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}/)
 assert.match(a,/notes\.length>2000/)
 assert.match(a,/\.eq\('status','draft'\)/)
})
test('financial draft notes are loaded and editable in four languages',()=>{
 assert.match(page,/counterparty_id,notes(?:,[a-z_]+)*'\)/)
 assert.match(page,/action=\{updateDraftNotes\}/)
 assert.match(page,/nl:'Notities bij document',fr:'Notes du document',en:'Document notes',de:'Dokumentnotizen'/)
})

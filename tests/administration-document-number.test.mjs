import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync('supabase/migrations/20261027230000_administration_document_number_guard.sql','utf8')
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('financial numbers reject duplicates and require numbers before review',()=>{
 assert.match(sql,/pg_advisory_xact_lock/)
 assert.match(sql,/Duplicate financial document number/)
 assert.match(sql,/document_number is null/)
 assert.match(sql,/Existing duplicate financial document numbers/)
})
test('draft document numbers can be corrected before review',()=>{
 assert.match(page,/async function updateDraftDocumentNumber/)
 assert.match(page,/action=\{updateDraftDocumentNumber\}/)
 assert.match(page,/\.eq\('status','draft'\)/)
})

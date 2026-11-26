import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('document bucket supports the validated original formats without weakening scan gates',()=>{
 const sql=read('supabase/migrations/20261126180000_work_media_document_types.sql')
 const validation=read('lib/upload-security.ts')
 for(const mime of ["text/plain","text/csv","application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.presentationml.presentation","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]){
  assert.ok(validation.includes(mime),mime)
  assert.ok(sql.includes("'"+mime+"'"),mime)
 }
 assert.match(sql,/WHERE id='work-media' AND public=false/)
 assert.match(sql,/AS RESTRICTIVE FOR INSERT TO authenticated/)
 assert.ok(sql.includes("storage.foldername(name))[2]='document'"))
 assert.ok(sql.includes('public.upt_is_approved()'))
 assert.doesNotMatch(sql,/FOR SELECT|GRANT\s|UPDATE public\.upload_security_scans/)
 assert.ok(read('supabase/migrations/20261109102345_operational_media_restrictive_scan_gate.sql').includes('storage_media_scan_is_clean'))
 assert.ok(read('scripts/production-preflight-readonly.sql').includes("'private_work_media_document_types', true"))
})

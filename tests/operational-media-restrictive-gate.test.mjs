import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('a restrictive Storage SELECT gate protects operational media from future policy additions',()=>{
 const sql=read('supabase/migrations/20261109102345_operational_media_restrictive_scan_gate.sql')
 assert.match(sql,/as restrictive for select to authenticated/)
 assert.match(sql,/upt_private\.storage_media_scan_is_clean\(bucket_id,name\)/)
 for(const bucket of ['chat-attachments','incident-photos','work-media'])assert.ok(sql.includes("'"+bucket+"'"))
 assert.match(sql,/Prerequisite trusted malware scan helper is absent/)
 assert.doesNotMatch(sql,/grant (?:all|select) on storage\.objects to authenticated/)
})
test('quarantined offline upload retries check uploader-authorized scan status, not blocked storage list',()=>{
 const queue=read('lib/crew-queue.ts')
 assert.match(queue,/upt_upload_scan_status/)
 assert.match(queue,/UPLOAD_SECURITY_BLOCKED/)
 assert.match(queue,/if\(scanStatus==='infected'\)/)
 assert.match(queue,/\['pending','scanning','clean','scan_failed'\]/)
 assert.match(queue,/if\(!listError&&existing\?\.some/)
})
test('incident image and video controls show a localized non-clickable unavailable state',()=>{
 const page=read('app/(app)/incidents/page.tsx')
 assert.match(page,/mediaUnavailable/)
 assert.match(page,/if\(!url\)return <span role="status"/)
 for(const locale of ['nl:','fr:','en:','de:'])assert.ok(page.includes(locale))
 assert.match(page,/createSignedUrl\(i\.photo_path!,300\)/)
})

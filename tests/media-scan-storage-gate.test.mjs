import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const sql=read('supabase/migrations/20261109103000_private_media_scan_read_gate.sql')
test('all three scanned media buckets are quarantined by restrictive Storage SELECT policy',()=>{
 assert.match(sql,/as restrictive for select to authenticated/)
 for(const bucket of ['chat-attachments','incident-photos','work-media'])assert.ok(sql.includes("'"+bucket+"'"),bucket)
 assert.match(sql,/upt_private\.scanned_media_clean\(bucket_id,name\)/)
 assert.match(sql,/s\.status='clean'/)
 assert.doesNotMatch(sql,/status='clean'\s*from storage\.objects/)
})
test('unscanned historical media backfills only as pending without modifying existing results',()=>{
 assert.match(sql,/from storage\.objects o/)
 assert.match(sql,/on conflict\(bucket_id,storage_path\) do nothing/)
 assert.match(sql,/'pending'\s*from storage\.objects/)
 assert.doesNotMatch(sql,/on conflict.*do update/is)
})
test('verdict function is read-only, narrowly scoped and protected from anonymous calls',()=>{
 assert.match(sql,/security definer set search_path='pg_catalog'/)
 assert.match(sql,/revoke all on function upt_private\.scanned_media_clean\(text,text\) from public,anon,authenticated/)
 assert.match(sql,/grant execute on function upt_private\.scanned_media_clean\(text,text\) to authenticated/)
 assert.doesNotMatch(sql,/update public\.upload_security_scans/)
})
test('offline upload retries may confirm a pending file without relying on SELECT list visibility',()=>{
 const source=read('lib/crew-queue.ts')
 assert.match(source,/upt_upload_scan_status/)
 assert.match(source,/scan_failed/)
 assert.match(source,/UPLOAD_SECURITY_BLOCKED/)
})
test('chat and other media retain visible unavailable placeholders rather than broken links',()=>{
 const chat=read('components/crew/chat-client.tsx')
 const docs=read('components/crew/event-documents-panel.tsx')
 const incidents=read('app/(app)/incidents/page.tsx')
 assert.match(chat,/if\(!attachment\.url\)/)
 assert.match(chat,/url:url\?\.signedUrl\?\?''/)
 assert.match(chat,/locale=\{uiLocale\}/)
 assert.match(docs,/scanPendingCopy/)
 assert.match(incidents,/mediaUnavailable/)
})

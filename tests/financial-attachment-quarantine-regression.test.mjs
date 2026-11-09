import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261109101500_financial_attachment_malware_quarantine.sql','utf8')
const worker=readFileSync('supabase/functions/malware-scan/index.ts','utf8')
const api=readFileSync('app/api/administration/finance/attachments/[id]/route.ts','utf8')
const ui=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')

test('financial originals are queued in trusted storage triggers as documents',()=>{
 assert.match(migration,/create or replace function upt_private\.queue_upload_security_scan\(\)/)
 assert.match(migration,/new\.bucket_id not in \([\s\S]*'admin-financial-attachments'/)
 assert.match(migration,/when new\.bucket_id='admin-financial-attachments' then 'document'/)
 assert.match(migration,/on conflict\(bucket_id,storage_path\) do update set/)
 assert.match(migration,/status='pending'/)
 assert.match(migration,/scanned_at=null/)
 assert.match(migration,/where o\.bucket_id='admin-financial-attachments'/)
 assert.match(migration,/on conflict\(bucket_id,storage_path\) do nothing/)
 assert.doesNotMatch(migration,/status='clean'\s*(?:,|\))/)
})
test('signed URLs cannot bypass clean-only storage RLS',()=>{
 const gate=migration.slice(migration.indexOf('drop policy if exists admin_financial_storage_read'))
 assert.match(gate,/create policy admin_financial_storage_read/)
 assert.match(gate,/bucket_id='admin-financial-attachments'/)
 assert.match(gate,/public\.upt_can_manage_administration\(\)/)
 assert.match(gate,/join public\.upload_security_scans scan/)
 assert.match(gate,/scan\.status='clean'/)
 assert.match(gate,/a\.storage_path=objects\.name/)
 assert.match(migration,/grant select on public\.upload_security_scans to authenticated/)
 assert.match(migration,/create policy admin_financial_scan_status_read/)
 assert.match(migration,/exists \(\s*select 1 from public\.admin_financial_attachments/)
 assert.doesNotMatch(migration,/grant (?:all|update|insert|delete) on public\.upload_security_scans to authenticated/i)
})
test('scanner accepts the finance bucket but still requires secret and scanner provider',()=>{
 assert.match(worker,/const allowedBuckets=new Set\(\["chat-attachments","incident-photos","work-media","admin-financial-attachments"\]\)/)
 assert.match(worker,/CLOUDMERSIVE_API_KEY/)
 assert.match(worker,/MALWARE_SCAN_CRON_SECRET/)
 assert.match(worker,/x-upt-scan-secret/)
 assert.match(worker,/allowedBuckets\.has\(row\.bucket_id\)/)
 assert.match(worker,/verdict\.Successful!==true/)
 assert.match(worker,/status:isClean\?"clean":"infected"/)
})
test('finance UI does not expose links for pending scans and displays four localized statuses',()=>{
 assert.match(ui,/\.from\('upload_security_scans'\)/)
 assert.match(ui,/href=\{'\/api\/administration\/finance\/attachments\/\'/)
 assert.match(ui,/attachmentScanLabel\(a\.storage_path\)/)
 assert.match(ui,/scanLabel\?<span/)
 assert.match(ui,/:'\/api\/administration\/finance\/attachments\/'/)
 assert.match(ui,/verdict==='clean'/)
 assert.match(ui,/verdict==='scan_failed'/)
 assert.match(ui,/verdict==='infected'\|\|verdict==='suspicious'/)
 for(const locale of ['nl','fr','en','de']) assert.match(ui,new RegExp(locale+':\\{upload:'))
 for(const key of ['scanPending','scanFailed','scanBlocked','scanUnavailable']){
  assert.equal((ui.match(new RegExp(key+':','g'))??[]).length,4,key)
 }
})
test('finance download API enforces status before requesting signed URL',()=>{
 assert.match(api,/\.from\('upload_security_scans'\)/)
 assert.match(api,/if\(scanError\)return respond\('scan_status_unavailable',503\)/)
 assert.match(api,/if\(scan\?\.status!=='clean'\)return respond\('attachment_awaiting_security_scan',423\)/)
 assert.match(api,/if\(scan\?\.status==='infected'\|\|scan\?\.status==='suspicious'\)/)
 assert.ok(api.indexOf("if(scan?.status!=='clean')")<api.indexOf('createSignedUrl('))
})

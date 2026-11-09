import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const storage=readFileSync(new URL('../tests/sql/storage-security.sql',import.meta.url),'utf8')
const migration=readFileSync(new URL('../supabase/migrations/20261109104142_admin_provider_bank_approval_fk_index.sql',import.meta.url),'utf8')
test('storage role acceptance verifies pending is denied and clean is explicitly granted only to authorized actors',()=>{
 const pending=storage.indexOf("status='pending'")
 const beforeClean=storage.indexOf("status='clean'")
 const linked=storage.indexOf('FAIL responsible incident-photo access')
 assert.ok(pending>=0&&beforeClean>pending&&linked>beforeClean)
 for(const value of ['FAIL pending originals exposed to owner','FAIL pending originals exposed to Responsible',
   "UPDATE public.upload_security_scans", "ROLLBACK;"])assert.ok(storage.includes(value),value)
})
test('provider settlement approval foreign key gets a covering btree index',()=>{
 assert.match(migration,/create index if not exists admin_provider_bank_settlements_approved_by_idx/i)
 assert.match(migration,/on public\.admin_provider_bank_settlements \(approved_by\)/)
})

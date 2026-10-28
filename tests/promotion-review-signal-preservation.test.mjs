import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('admin review preserves existing reference and duplicate evidence signals',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261025130000_promotion_review_signal_preservation.sql',import.meta.url),'utf8')
 assert.match(sql,/coalesce\(v_row\.verification_details,'\{\}'::jsonb\)/)
 assert.match(sql,/\|\| jsonb_build_object\('review_reason'/)
 assert.match(sql,/for update/)
 assert.match(sql,/Evidence already finalized/)
 assert.doesNotMatch(sql,/upt_admin_record_promotion_violation\s*\(/)
})

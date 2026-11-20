import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const root=new URL('../',import.meta.url)
const read=(path)=>readFile(new URL(path,root),'utf8')

test('promotion evidence upload checks magic bytes, ownership and blocking',async()=>{
 const page=await read('app/(app)/portals/promotion/tasks/page.tsx')
 assert.match(page,/bytes\.subarray\(0,8\)\.equals/)
 assert.match(page,/Image format does not match file contents/)
 assert.match(page,/upt_promotion_is_blocked/)
 assert.match(page,/\.eq\("user_id",user\.id\)/)
 assert.match(page,/if\(saveError\)\{/)
 assert.match(page,/if\(cleanupError\)throw new Error\("Evidence registration failed; uploaded file cleanup also failed"\)/)
})
test('database checks image MIME and size and preserves audit trail',async()=>{
 const sql=await read('supabase/migrations/20261025110000_promotion_evidence_submission_hardening.sql')
 assert.match(sql,/o\.owner_id=v_actor::text/)
 assert.match(sql,/image\/jpeg/)
 assert.match(sql,/image\/png/)
 assert.match(sql,/image\/webp/)
 assert.match(sql,/10485760/)
 assert.match(sql,/upt_promotion_is_blocked/)
})
test('reference matching is never interpreted as publication verification or sanction',async()=>{
 const sql=await read('supabase/migrations/20261025100000_promotion_reference_review_signals.sql')
 assert.match(sql,/'publication_verified',false/)
 assert.match(sql,/'requires_independent_verification',true/)
 assert.doesNotMatch(sql,/upt_admin_record_promotion_violation\s*\(/)
 assert.doesNotMatch(sql,/verification_status\s*=\s*'verified'/)
})
test('promotion task actions recheck block state server-side',async()=>{
 const page=await read('app/(app)/portals/promotion/tasks/page.tsx')
 const start=page.slice(page.indexOf('async function changePromotionTaskStatus'),page.indexOf('async function submitPromotionEvidence'))
 assert.match(start,/upt_promotion_is_blocked/)
 assert.match(start,/if\(blockError\|\|blocked\)/)
})

test('cancelled promotion assignments cannot submit evidence server-side',async()=>{
 const page=await read('app/(app)/portals/promotion/tasks/page.tsx')
 const submission=page.slice(page.indexOf('async function submitPromotionEvidence'),page.indexOf('export default async function PromotionTasks'))
 assert.match(submission,/assigned\.status!=="IN PROGRESS"/)
 assert.match(submission,/\.eq\("user_id",user\.id\)/)
})

test('promotion evidence validates actual byte count before storage upload',async()=>{
 const page=await read('app/(app)/portals/promotion/tasks/page.tsx')
 const submission=page.slice(page.indexOf('async function submitPromotionEvidence'),page.indexOf('export default async function PromotionTasks'))
 assert.match(submission,/bytes\.length!==file\.size/)
 assert.match(submission,/bytes\.length>10\*1024\*1024/)
 assert.ok(submission.indexOf('bytes.length!==file.size')<submission.indexOf('.storage.from("work-media").upload('))
})

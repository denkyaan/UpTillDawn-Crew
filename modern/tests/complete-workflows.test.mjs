import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {workflowCopy} from "../src/shared/workflow-copy.ts"
import {languages} from "../src/shared/i18n.ts"
import {validReviewReason,validateCheckinDecision} from "../src/shared/approval-validation.ts"
const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8")
test("promotion proof uses own assignment, local SHA256, private media bucket and audited RPC",()=>{
 const src=read("lib/promotion-evidence.ts"),screen=read("screens/promotion.tsx")
 assert.ok(src.includes('db.storage.from("work-media").upload(path,file'))
 assert.ok(src.includes('uid+"/promotion/"+crypto.randomUUID()'))
 assert.ok(src.includes('crypto.subtle.digest("SHA-256",raw)'))
 assert.ok(src.includes('p_storage_path:path,p_sha256:hash'))
 assert.ok(src.includes('rpc("upt_submit_promotion_evidence"'))
 assert.ok(src.includes("validPhotoSignature(file.type"))
 assert.ok(src.includes("await verifyOwnSession()"))
 assert.ok(src.includes("if(actor!==uid)"))
 assert.ok(src.includes("file.size>10*1024*1024"))
 assert.ok(!src.includes("remove([path])"))
 assert.ok(screen.includes('await uploadOwnPromotionEvidence(uid,id,file)'))
 assert.ok(screen.includes("writesAvailable()&&"))
})
test("evidence review is admin-only, self read is scoped, and rationale validated",()=>{
 const src=read("lib/promotion-evidence.ts"),component=read("components/promotion-evidence-review.tsx")
 assert.ok(src.includes('.eq("submitted_by",uid)'))
 assert.ok(src.includes('.limit(80).abortSignal(signal)'))
 assert.ok(src.includes('rpc("upt_admin_review_promotion_evidence"'))
 assert.ok(component.includes('if(identity!.role!=="admin")return null'))
 assert.ok(component.includes('!["verified","rejected"].includes(item.verification_status)'))
 assert.equal(validReviewReason("A confirmed copy"),"A confirmed copy")
 assert.throws(()=>validReviewReason("short"))
 assert.throws(()=>validReviewReason("x".repeat(1001)))
})
test("check-in decision denies missing rejection reason; no direct table updates or own approval",()=>{
 const src=read("lib/checkin-review.ts"),screen=read("components/checkin-review.tsx")
 assert.equal(validateCheckinDecision(true,""),null)
 assert.equal(validateCheckinDecision(false,"Not valid GPS"),"Not valid GPS")
 assert.throws(()=>validateCheckinDecision(false,""))
 assert.throws(()=>validateCheckinDecision(false,"x".repeat(501)))
 assert.ok(src.includes('rpc("upt_decide_check_in"'))
 assert.ok(src.includes('.eq("status","pending")'))
 assert.ok(src.includes('.limit(60)'))
 assert.ok(!src.includes(".update("))
 assert.ok(screen.includes('row.user_id===uid'))
 assert.ok(screen.includes('row.user_id!==uid'))
})
test("new workflow UX strings available for four locales",()=>{
 for(const language of languages){
  const t=workflowCopy(language)
  for(const key of ["proofFile","proofUncertain","pendingCheckins","approve","deny","adminEvidence","reviewReason"])
   assert.ok(t[key].length>=3,language+":"+key)
 }
})

test("check-out uses existing audited RPC, separate pending read, no own approvals",()=>{
 const src=read("lib/checkin-review.ts"),screen=read("components/checkin-review.tsx")
 assert.ok(src.includes('.from("check_outs")'))
 assert.ok(src.includes('rpc("upt_decide_check_out"'))
 assert.ok(src.includes('.eq("status","pending").order("requested_at"'))
 assert.ok(src.includes('p_check_out:id,p_approve:approve,p_notes:clean'))
 assert.ok(!src.includes(".update("))
 assert.ok(screen.includes('kind="out"'))
 assert.ok(screen.includes('row.user_id===uid'))
 assert.ok(screen.includes('row.user_id!==uid'))
})
test("timekeeping lazy loads only on own hours tab, and check-outs stay in existing crew tab",()=>{
 const crew=read("screens/crew.tsx"),tracker=read("components/break-tracker.tsx")
 assert.ok(crew.includes('const BreakTracker=lazy(()=>import("../components/break-tracker"))'))
 assert.ok(crew.includes('view==="hours"?<Hours uid={uid}/>'))
 assert.ok(crew.includes('<BreakTracker key={selected.id} session={selected}/>'))
 assert.ok(crew.includes('ownCheckOuts(uid,signal)'))
 assert.ok(tracker.includes("MIGRATION_WRITES_ENABLED&&active"))
 assert.ok(tracker.includes("breakAlert(activeBreak.started_at,now)"))
 assert.ok(tracker.includes("window.setInterval"))
 assert.ok(tracker.includes("ownSessionTimeSummary"))
 for(const ban of ["setTimeout(()=>stopOwnBreak","localStorage","navigator.geolocation"])assert.ok(!tracker.includes(ban))
})

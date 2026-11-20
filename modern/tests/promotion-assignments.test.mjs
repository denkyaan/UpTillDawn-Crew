import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {copy,languages} from "../src/shared/i18n.ts"
const read=p=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8")
test("Promotion reads only own assignment IDs under RLS; never enumerates generic tasks",()=>{
 const source=read("lib/operational-reads.ts")
 const start=source.indexOf("export async function promotionTasks(")
 const fn=source.slice(start)
 assert.ok(fn.includes('.from("task_assignments")'))
 assert.ok(fn.includes('.eq("user_id",uid)'))
 assert.ok(fn.includes('tasks!inner(id,event_id,title,description,promotion_only)'))
 assert.ok(fn.includes('.eq("tasks.promotion_only",true)'))
 assert.ok(fn.includes('.limit(80).abortSignal(signal)'))
 assert.ok(fn.includes('if(rows.some(row=>!row.tasks))throw'))
 assert.ok(!fn.includes('.from("tasks")'))
 assert.ok(!fn.includes(".update("))
})
test("starting own promotion uses promotion-specific audited RPC, never generic completion",()=>{
 const ops=read("lib/operational-mutations.ts"),screen=read("screens/promotion.tsx")
 assert.ok(ops.includes('rpc("upt_start_promotion_task",{p_assignment:assignmentId})'))
 assert.ok(ops.includes('await verifyOwnSession()'))
 assert.ok(ops.includes('requireUuid(assignmentId)'))
 assert.ok(!ops.includes('upt_complete_promotion_task'))
 assert.ok(screen.includes("writesAvailable()&&"))
 assert.ok(screen.includes('await startOwnPromotionTask(id)'))
 assert.ok(!screen.includes("updateOwnTaskStatus("))
 assert.ok(screen.includes("r.refresh();setBusy(null)"))
})
test("Promotion status, availability and evidence limitations are translated in four locales",()=>{
 for(const locale of languages){
  const t=copy(locale)
  for(const key of ["promotionNotStarted","promotionInProgress","promotionCompleted","promotionCancelled","promotionAssignmentsNotice","promotionStartTask","promotionStartFailed","promotionEvidencePending"])
   assert.ok(t[key].length>=3,locale+":"+key)
 }
})

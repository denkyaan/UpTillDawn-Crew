import {assertOriginalSourceRoutes} from './helpers/modern-original-source-contract.mjs'
import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {parseQrResult,validIncident,normalizedReviewReason,assertUuid} from "../modern/src/shared/workflow-contracts.ts"

const read=path=>readFileSync(path,"utf8")
const id="12345678-1234-4234-8234-123456789012"
test("QR parser rejects forged/unknown action states and bounds content",()=>{
 assert.throws(()=>parseQrResult(null),/invalid_qr_response/)
 assert.throws(()=>parseQrResult([]),/invalid_qr_response/)
 assert.throws(()=>parseQrResult({action:"approved",kind:"start"}),/invalid_qr_response/)
 assert.deepEqual(parseQrResult({action:"requested",items:null}).items,[])
})
test("QR parser accepts only known requests and strips oversized/suspicious titles",()=>{
 const r=parseQrResult({action:"requested",kind:"start",request_id:id,reviewer:"responsible",items:[{id,title:"Ok"},{id:3,title:"Invalid"},{id:"x",title:"z".repeat(500)}]})
 assert.equal(r.action,"requested")
 assert.equal(r.kind,"start")
 assert.equal(r.requestId,id)
 assert.deepEqual(r.items,[{id,title:"Ok"}])
 const p=parseQrResult({action:"pending",kind:"unknown",request_id:12,reviewer:"r".repeat(100),items:[]})
 assert.equal(p.kind,null)
 assert.equal(p.requestId,null)
 assert.equal(p.reviewer,null)
 const tooMany=parseQrResult({action:"confirm_required",items:Array.from({length:500},(_,i)=>({id:String(i),title:"x"}))})
 assert.equal(tooMany.items.length,40)
})
test("Incident payload accepts validated minimal fields and rejects ID spoofing/invalid GPS",()=>{
 const base={operationId:id,eventId:id,message:"Equipment damaged",category:"equipment",urgency:"urgent"}
 assert.deepEqual(validIncident(base),{event_id:id,message:"Equipment damaged",category:"equipment",urgency:"urgent"})
 for(const value of [{...base,eventId:"not-a-uuid"},{...base,operationId:"bad"},{...base,category:"admin"},{...base,urgency:"delete"},{...base,message:"  "},{...base,message:"x".repeat(4001)},{...base,peopleInvolved:"x".repeat(2001)},{...base,position:{latitude:95,longitude:4,accuracy:5}},{...base,position:{latitude:50,longitude:181,accuracy:5}},{...base,position:{latitude:50,longitude:4,accuracy:-10}}]){
  assert.throws(()=>validIncident(value))
 }
 const result=validIncident({...base,workplaceId:id,position:{latitude:50.88,longitude:4.74,accuracy:20},peopleInvolved:"  Team  "})
 assert.equal(result.workplace_id,id)
 assert.deepEqual({latitude:result.latitude,longitude:result.longitude,accuracy:result.accuracy},{latitude:50.88,longitude:4.74,accuracy:20})
 assert.equal(result.people_involved,"Team")
})
test("timesheet decisions validate reason and UUID without trusting client flags",()=>{
 assert.equal(normalizedReviewReason(true,""),null)
 assert.equal(normalizedReviewReason(false," Missing break "),"Missing break")
 for(const reason of ["", "  ","x", "a".repeat(1001)])assert.throws(()=>normalizedReviewReason(false,reason))
 assert.throws(()=>normalizedReviewReason("yes"))
 assert.equal(assertUuid(id),id)
 assert.throws(()=>assertUuid("admin"))
})
test("QR, timesheet and incident UI use audited RPCs, live identity verification, and disabled candidate writes",()=>{
 const op=read("modern/src/lib/transactional-operations.ts")
 const session=read("modern/src/lib/operational-writes.ts")

 for(const rpc of ["upt_qr_request","upt_submit_timesheet","upt_review_timesheet","upt_lock_timesheet","upt_sync_operation"])
  assert.ok(op.includes('rpc("'+rpc+'"'),"Missing "+rpc)
 for(const fn of ["requestOwnQr","submitOwnTimesheet","reviewAllowedTimesheet","lockApprovedTimesheet","submitOwnIncident"])
  assert.ok(op.includes("export async function "+fn+"("))
 assert.ok((op.match(/await verifyOwnSession\(\)/g)||[]).length>=5)
 assert.ok(op.includes('p_type:"incident"')&&op.includes("p_id:input.operationId"))
 assert.ok(!/\.from\([^)]*\)\.insert\(|\.from\([^)]*\)\.update\(/.test(op))
 assert.ok(session.includes('VITE_MIGRATION_ALLOW_WRITES==="true"'))
 assertOriginalSourceRoutes()
 assert.ok(read("modern/src/screens/qr-workflow.tsx").includes("MIGRATION_WRITES_ENABLED"))
 assert.ok(read("modern/src/screens/incident-report.tsx").includes("MIGRATION_WRITES_ENABLED"))
 assert.ok(read("modern/src/screens/timesheet-workspace.tsx").includes("MIGRATION_WRITES_ENABLED"))
})
test("timesheet review RLS uses bounded own/admin queries; no member can approve self",()=>{
 const queries=read("modern/src/lib/timesheet-queries.ts")
 const workspace=read("modern/src/screens/timesheet-workspace.tsx")
 assert.ok(queries.includes('.from("timesheets")'))
 assert.ok(queries.includes('.eq("user_id",uid)'))
 assert.ok(queries.includes(".limit(80).abortSignal(signal)"))
 assert.ok(workspace.includes('sheet.user_id===uid'))
 assert.ok(workspace.includes('rows=(review.data||[]).filter(t=>t.user_id!==uid)'))
 assert.ok(workspace.includes('await reviewAllowedTimesheet(sheet.id'))
 assert.ok(workspace.includes('await lockApprovedTimesheet(sheet.id)'))
 assert.ok(!queries.includes('.insert(')&&!queries.includes('.update('))
})
test("incident retries reuse operation UUID and location; no fake offline dispatch or approvals",()=>{
 const incident=read("modern/src/screens/incident-report.tsx")
 const qr=read("modern/src/screens/qr-workflow.tsx")
 assert.ok(incident.includes("previous?.signature===signature?previous"))
 assert.ok(incident.includes("operationId:next.operationId,position:next.position"))
 assert.ok(incident.includes("NIET verzonden"))
 assert.ok(qr.includes("geen goedgekeurde check-in"))
 const env=read("modern/.env.example")
 assert.ok(env.includes("VITE_MIGRATION_ALLOW_WRITES=false"))
 assert.ok(read("modern/scripts/inventory.mjs").includes("productionCutoverAllowed:false"))
})

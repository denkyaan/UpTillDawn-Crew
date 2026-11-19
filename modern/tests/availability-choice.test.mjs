import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {submissionChoice} from "../src/shared/availability-choice.ts"
import {copy,languages} from "../src/shared/i18n.ts"

test("cancel an accepted event after registration deadline without disabled-select fallback",()=>{
 assert.equal(submissionChoice("can",false,true),"cannot")
 assert.equal(submissionChoice("cannot",false,true),"cannot")
 assert.equal(submissionChoice("can",true,false),"can")
 assert.equal(submissionChoice("cannot",true,false),"cannot")
 assert.throws(()=>submissionChoice("can",false,false),/event_registration_closed/)
 assert.throws(()=>submissionChoice("invalid",true,false),/invalid_availability_choice/)
})
test("availability UI uses state, never absent FormData select value, and requires withdrawal reason",()=>{
 const source=readFileSync(new URL("../src/screens/events.tsx",import.meta.url),"utf8")
 assert.ok(source.includes("submissionChoice(choice,canJoin,canCancel)"))
 assert.ok(source.includes('requiresReason=choice==="cannot"&&previous?.response==="can"'))
 assert.ok(source.includes("required={requiresReason}"))
 assert.ok(source.includes("availabilityVerified={availability!==null&&!availabilityError}"))
 assert.ok(!source.includes('fd.get("response")'))
 const db=readFileSync(new URL("../src/lib/availability.ts",import.meta.url),"utf8")
 assert.ok(db.includes('rpc("upt_set_event_availability_with_reason"'))
 assert.ok(db.includes('VITE_MIGRATION_ALLOW_WRITES!=="true"'))
})
test("event RSVP and withdrawal UI has all four localized labels",()=>{
 for(const language of languages){
  const t=copy(language)
  for(const key of ["availabilityLabel","canAttend","cannotAttend","setupAvailable","breakdownAvailable","withdrawalReason","availabilityFailed","saving","saveAvailability","registrationClosed"])
   assert.ok(typeof t[key]==="string"&&t[key].length>2,language+":"+key)
 }
})

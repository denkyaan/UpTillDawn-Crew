import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {encode} from "../../lib/migration/wire.ts"
import {nativeAdminActionIds} from "../src/api/native-admin-actions.ts"
import {nativeWaveTwoActionIds} from "../src/api/native-platform-actions.ts"
import {nativeWaveThreeActionIds} from "../src/api/native-event-shift-actions.ts"
import {nativeInventoryActionIds} from "../src/api/native-inventory-checklist-actions.ts"
import {nativeRosterActionIds} from "../src/api/native-roster-handover-actions.ts"
import {nativeCatalogActionIds} from "../src/api/native-catalog-event-actions.ts"
import {megaPeopleActionIds} from "../src/api/native-mega-people-actions.ts"
import {megaOperationsActionIds} from "../src/api/native-mega-operations-actions.ts"
import {megaCrewEventActionIds} from "../src/api/native-mega-crew-event-actions.ts"
import {megaMakerActionIds,godLogoutId} from "../src/api/native-mega-maker-actions.ts"
import {nativeWaveNineActionIds} from "../src/api/native-wave-nine-safe-actions.ts"
import {finalCrewActionIds} from "../src/api/native-final-crew-actions.ts"
import {finalOperationsActionIds} from "../src/api/native-final-operations-actions.ts"
import {finalAdminDetailsActionIds} from "../src/api/native-final-admin-details.ts"
import {finalFinanceActionIds} from "../src/api/native-final-finance-actions.ts"
import {finalAgreementsActionIds} from "../src/api/native-final-agreements-actions.ts"
const groups=[nativeAdminActionIds,nativeWaveTwoActionIds,nativeWaveThreeActionIds,
 nativeInventoryActionIds,nativeRosterActionIds,nativeCatalogActionIds,
 megaPeopleActionIds,megaOperationsActionIds,megaCrewEventActionIds,
 megaMakerActionIds,nativeWaveNineActionIds,finalCrewActionIds,
 finalOperationsActionIds,finalAdminDetailsActionIds,finalFinanceActionIds,finalAgreementsActionIds]
const all=groups.flat()
const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
function request(id){
 const input=new FormData();const fd=new FormData()
 input.set("_id",id)
 input.set("_args",JSON.stringify(encode([fd],input)))
 return new Request(origin+"/api/migration/actions",{
  method:"POST",headers:{Origin:origin,"Sec-Fetch-Site":"same-origin",
   "X-UpTillDawn-Action-Hint":id},body:input
 })
}
test("all 163 distinct actions remain in the native worker, not a Next fallback",async()=>{
 assert.equal(all.length,163)
 assert.equal(new Set(all).size,163)
 let attemptedLegacy=0
 const env={UPT_MIGRATION_ALLOW_WRITES:"true",
  SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_fixture",
  MAIN_AUTH:{fetch:async()=>{attemptedLegacy++;throw Error("LEGACY_FORBIDDEN")}}}
 for(const id of all){
  const response=await app.request(request(id),{},env)
  // God logout explicitly clears its cookie after the ordinary session has
  // expired and is NOT a login bypass.
  if(id===godLogoutId){
   assert.equal(response.status,200,id)
  }else assert.equal(response.status,401,id)
 }
 assert.equal(attemptedLegacy,0)
})
test("all 163 actions are blocked before auth or legacy networking in public QA",async()=>{
 const env={UPT_MIGRATION_ALLOW_WRITES:"false",
  SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_fixture",
  MAIN_AUTH:{fetch:async()=>{throw Error("PUBLIC_LEGACY_FORBIDDEN")}}}
 for(const id of all){
  const response=await app.request(request(id),{},env)
  assert.equal(response.status,503,id)
  assert.deepEqual(await response.json(),{error:"migration_writes_disabled"},id)
 }
})

import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {encode} from "../../lib/migration/wire.ts"
import app from "../src/api/worker.ts"
import {finalCrewActionIds,finalCrewActionAllowed,finalCrewActionResponse} from "../src/api/native-final-crew-actions.ts"
import {finalOperationsActionIds,finalOperationsActionAllowed,finalOperationsActionResponse} from "../src/api/native-final-operations-actions.ts"
import {finalAdminDetailsActionIds,finalAdminDetailsAllowed,finalAdminDetailsResponse} from "../src/api/native-final-admin-details.ts"
import {finalFinanceActionIds,finalFinanceActionAllowed,finalFinanceResponse} from "../src/api/native-final-finance-actions.ts"
import {finalAgreementsActionIds,finalAgreementsAllowed,finalAgreementsResponse} from "../src/api/native-final-agreements-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const actorId="aaaabbbb-cccc-4ddd-8eee-000000000001"
const subject="aaaabbbb-cccc-4ddd-8eee-000000000002"
const event="aaaabbbb-cccc-4ddd-8eee-000000000003"
const all=[...finalCrewActionIds,...finalOperationsActionIds,...finalAdminDetailsActionIds,
 ...finalFinanceActionIds,...finalAgreementsActionIds]
const groups=[
 [finalCrewActionIds,finalCrewActionAllowed],[finalOperationsActionIds,finalOperationsActionAllowed],
 [finalAdminDetailsActionIds,finalAdminDetailsAllowed],[finalFinanceActionIds,finalFinanceActionAllowed],
 [finalAgreementsActionIds,finalAgreementsAllowed]
]
function post(id,fields={},opts={}){
 const fd=new FormData()
 for(const [key,value] of Object.entries(fields))fd.append(key,value)
 const body=new FormData()
 body.set("_id",opts.idOverride||id)
 body.set("_args",JSON.stringify(encode(opts.noForm?[]:[fd],body)))
 return new Request(origin+"/api/migration/actions",{
  method:"POST",
  headers:{Origin:opts.origin||origin,"Sec-Fetch-Site":"same-origin",
   "X-UpTillDawn-Action-Hint":id},body
 })
}
function fixture({role="admin",admin=true,assignments=[],accountBlocked=false}={}){
 const calls=[]
 const user={id:actorId,role,effective_role:role,approved:true,
  account_blocked:accountBlocked,is_owner:false}
 const query=table=>{
  const q={
   select:()=>q,eq:()=>q,in:()=>q,is:()=>q,not:()=>q,
   lte:()=>q,neq:()=>q,order:()=>q,limit:()=>q,
   update:value=>{calls.push(["update",table,value]);return q},
   insert:value=>{calls.push(["insert",table,value]);return q},
   delete:()=>{calls.push(["delete",table]);return q},
   single:async()=>({data:{id:subject,event_id:event,workplace_id:null,status:"draft"},error:null}),
   maybeSingle:async()=>({data:{id:subject,event_id:event,workplace_id:null,status:"draft"},error:null}),
   then:(resolve,reject)=>Promise.resolve({data:[{id:subject}],error:null}).then(resolve,reject)
  }
  return q
 }
 const db={
  auth:{getUser:async()=>({data:{user:{id:actorId}},error:null})},
  rpc:async(name,args)=>{
   calls.push(["rpc",name,args])
   if(name==="upt_current_session_context")return {data:[user],error:null}
   if(name==="upt_is_admin")return {data:admin,error:null}
   if(name==="upt_my_portal_assignments")return {data:assignments,error:null}
   return {data:true,error:null}
  },
  from:table=>{calls.push(["from",table]);return query(table)},
  storage:{from:bucket=>({
   upload:async()=>{calls.push(["upload",bucket]);return {error:null}},
   remove:async()=>{calls.push(["remove",bucket]);return {error:null}}
  })}
 }
 return {db,calls}
}
test("exactly all 57 remaining actions are registered once and source-exact",()=>{
 assert.deepEqual(groups.map(([ids])=>ids.length),[8,16,11,16,6])
 assert.equal(all.length,57)
 assert.equal(new Set(all).size,57)
 const registry=readFileSync(new URL("../../lib/migration/original-action-registry.ts",import.meta.url),"utf8")
 for(const [group,allowed] of groups)for(const id of group){
  assert.equal(allowed(id),true,id)
  assert.ok(registry.includes('"'+id+'"'),"Registered original action "+id)
  const [source,name]=id.split("#")
  const original=readFileSync(new URL("../../"+source,import.meta.url),"utf8")
  assert.ok(original.includes("function "+name+"("),"Original function missing: "+id)
 }
 assert.equal(all.some(id=>id.includes("fake")||id.includes("template-placeholder")),false)
})
test("all 57 candidate actions are blocked at the public Worker boundary",async()=>{
 const env={SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_fixture",UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{throw Error("Should never forward disabled writes")}}}
 for(const id of all){
  const res=await app.request(post(id),{},env)
  assert.equal(res.status,503,id)
  assert.deepEqual(await res.json(),{error:"migration_writes_disabled"},id)
 }
})
test("selected signed source actions preserve authorization and write shape",async()=>{
 const checks=[
  [finalCrewActionResponse,finalCrewActionIds.find(x=>x.endsWith("#updateBriefing")),
   {id:subject,title:"Crew brief",body:"Approved briefing body"}],
  [finalOperationsActionResponse,finalOperationsActionIds.find(x=>x.endsWith("#markAdministrationNotificationRead")),
   {notification_id:subject}],
  [finalAdminDetailsResponse,finalAdminDetailsActionIds.find(x=>x.endsWith("#receive")),
   {line:subject,item:subject,request:subject,quantity:"4"}],
  [finalFinanceResponse,finalFinanceActionIds.find(x=>x.endsWith("#createDraft")),
   {kind:"quote",net_amount:"25.00",tax_amount:"5.25"}],
  [finalAgreementsResponse,finalAgreementsActionIds.find(x=>x.endsWith("#saveTerms")),
   {id:subject,agreement_payment_terms:"30 days",agreement_cancellation_terms:"Written notice",
    agreement_liability_terms:"Policy",agreement_governing_law:"Belgium"}]
 ]
 for(const [handler,id,form] of checks){
  assert.ok(id)
  const f=fixture()
  const res=await handler(post(id,form),f.db,id)
  assert.equal(res.status,200,id)
  assert.ok(f.calls.some(x=>x[0]==="rpc"&&x[1]==="upt_current_session_context"),id)
 }
})
test("cross-origin and forged IDs reject before touching the backend",async()=>{
 const id=finalFinanceActionIds.find(x=>x.endsWith("#createDraft"))
 for(const opts of [{origin:"https://attacker.invalid"},{idOverride:finalFinanceActionIds[0]}]){
  const f=fixture()
  const response=await finalFinanceResponse(post(id,{},opts),f.db,id)
  assert.equal(response.status,opts.origin?403:404)
  assert.equal(f.calls.length,0)
 }
})
test("non-admin cannot approve roster or financial documents",async()=>{
 const ids=[
  finalOperationsActionIds.find(x=>x.endsWith("#changeStatus")),
  finalFinanceActionIds.find(x=>x.endsWith("#updateFinancialStatus")),
  finalAgreementsActionIds.find(x=>x.endsWith("#approveAgreement"))
 ]
 for(const id of ids){
  const f=fixture({role:"staff",admin:false})
  const response=id.includes("/rosters/")?
   await finalOperationsActionResponse(post(id,{id:subject,action:"approve"}),f.db,id):
   id.includes("finance/page.tsx")?
   await finalFinanceResponse(post(id,{document_id:subject,status:"approved"}),f.db,id):
   await finalAgreementsResponse(post(id,{id:subject,version_id:subject}),f.db,id)
  assert.equal(response.status,422,id)
  assert.equal(f.calls.some(x=>["insert","update","delete","upload"].includes(x[0])),false,id)
 }
})

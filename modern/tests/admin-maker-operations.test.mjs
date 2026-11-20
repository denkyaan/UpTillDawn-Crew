import test from "node:test"
import assert from "node:assert/strict"
import {summarizeAdministration,currentBelgianDate} from "../src/shared/admin-overview.ts"
import {adminOverviewText} from "../src/shared/admin-overview-copy.ts"
import {sanitizedMakerRoute,sanitizedMakerName,sanitizedMakerSeverity} from "../src/api/god-redaction.ts"
import {checkedDiagnostics,makerPulse,visibleMakerErrors} from "../src/shared/maker-triage.ts"
import {makerCopy} from "../src/shared/maker-copy.ts"
import {languages} from "../src/shared/i18n.ts"
const doc=(id,status,due,peppol_status=null)=>({
 id,kind:"invoice",document_number:id,issue_date:"2026-10-01",
 due_date:due,currency:"EUR",gross_amount:42,status,peppol_status,event_id:null
})
const inventory=(id,available,missing=0,damaged=0)=>({
 id,event_id:null,workplace_id:null,name:id,category:"merch",
 available_quantity:available,total_quantity:10,
 missing_quantity:missing,damaged_quantity:damaged,is_active:true
})
test("overview calculates only bounded records and never guesses bank balances",()=>{
 const out=summarizeAdministration({
  documents:[doc("overdue","issued","2026-11-10"),doc("paid","paid","2026-11-10"),
   doc("pending","pending","2026-11-19"),doc("peppol","draft","2026-11-29","failed")],
  payments:[{id:"payment",document_id:"paid",amount:12,paid_on:"2026-11-10",created_at:"2026-11-10"}],
  inventory:[inventory("bar",0,0,1),inventory("merch",6),inventory("tokens",5,2)]
 },"2026-11-19")
 assert.equal(out.overdue,1)
 assert.equal(out.peppolIssues,1)
 assert.equal(out.stockIssues,2)
 assert.equal(out.documents,4)
 assert.equal(out.payments,1)
 assert.equal(out.priorities.length,4)
 for(const row of out.priorities)assert.ok(["due","peppol","stock"].includes(row.kind))
 assert.deepEqual(Object.keys(out).sort(),[
  "documents","items","overdue","payments","peppolIssues","priorities","stockIssues"].sort())
})
test("overview never claims totals outside 100 recent entries or uses due today as overdue",()=>{
 const data={documents:Array.from({length:120},(_,i)=>doc(String(i),"issued","2025-01-01")),
  payments:[],inventory:[]}
 const out=summarizeAdministration(data,"2026-11-19")
 assert.equal(out.documents,100)
 assert.equal(out.overdue,100)
 assert.ok(out.priorities.length<=8)
 assert.equal(summarizeAdministration({documents:[doc("today","issued","2026-11-19")],
  payments:[],inventory:[]},"2026-11-19").overdue,0)
 assert.throws(()=>summarizeAdministration(data,"bad-date"))
 assert.equal(currentBelgianDate(new Date("2026-11-18T23:30:00.000Z")),"2026-11-19")
})
test("maker errors are prioritized by explicit maker flag, severity and timestamp",()=>{
 const errors=[
  {name:"Retry",severity:"low",needsMaker:false,at:"2026-11-19T10:00:00Z"},
  {name:"Sync",severity:"high",needsMaker:true,at:"2026-11-19T08:00:00Z"},
  {name:"Routing",severity:"critical",needsMaker:true,at:"2026-11-19T09:00:00Z"}
 ]
 const input={errors,recovery:[{status:"failed"},{status:"ok"},{status:"unhealthy"}],audit:[]}
 const source=checkedDiagnostics(input)
 assert.deepEqual(makerPulse(source),{errors:3,critical:2,needsMaker:2,failedRecovery:2})
 assert.deepEqual(visibleMakerErrors(errors,{onlyAction:true,search:""}).map(x=>x.name),["Routing","Sync"])
 assert.deepEqual(visibleMakerErrors(errors,{onlyAction:false,search:"sync"}).map(x=>x.name),["Sync"])
 assert.deepEqual(visibleMakerErrors(errors,{onlyAction:false,search:""}).map(x=>x.name),["Routing","Sync","Retry"])
 assert.throws(()=>checkedDiagnostics({errors:[],recovery:null,audit:[]}))
 assert.throws(()=>checkedDiagnostics({errors:Array(26).fill({}),recovery:[],audit:[]}))
})
test("maker worker strips query parameters, URLs, personal IDs and secret-looking errors",()=>{
 const route="/events/123e4567-e89b-12d3-a456-426614174000?token=secret"
 assert.equal(sanitizedMakerRoute(route),"/events/:id")
 assert.equal(sanitizedMakerRoute("/auth/12345678/profile#private"),"/auth/:id/profile")
 assert.equal(sanitizedMakerRoute("//evil.host/secret"),null)
 assert.equal(sanitizedMakerRoute("https://evil.host/account"),null)
 assert.equal(sanitizedMakerRoute("/api/%2e%2e/1234"),null)
 assert.equal(sanitizedMakerRoute("/account/person@example.com"),null)
 assert.equal(sanitizedMakerRoute("/log/"+("A".repeat(28))),"/log/:redacted")
 assert.equal(sanitizedMakerName("Bearer abc123"),"Redacted error")
 assert.equal(sanitizedMakerName("SECRET_TOKEN"),"Redacted error")
 assert.equal(sanitizedMakerName("TypeError"),"TypeError")
 assert.equal(sanitizedMakerSeverity("CRITICAL"),"critical")
 assert.equal(sanitizedMakerSeverity("Bearer abc"),null)
})
test("admin overview and God Mode triage are localized for all supported languages",()=>{
 for(const locale of languages){
  const a=adminOverviewText(locale),m=makerCopy(locale)
  for(const k of ["heading","overdue","peppol","stock","limited","noPayment"])
   assert.ok(a[k].length>10,locale+":"+k)
  for(const k of ["heading","needsMaker","critical","recoveryFailed","onlyAction","environment","privacy"])
   assert.ok(m[k].length>10,locale+":"+k)
 }
})

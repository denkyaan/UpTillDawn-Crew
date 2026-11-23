import test from "node:test"
import assert from "node:assert/strict"
import {buildXlsx} from "../src/api/worker-xlsx.ts"
import {nativeGuestlistImport,nativeGuestlistXlsx} from "../src/api/native-original-guestlist.ts"
import {forwardMainAuth} from "../src/api/main-auth.ts"
import {report} from "../scripts/legacy-route-audit.mjs"
import app from "../src/api/worker.ts"
const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const event="11111111-1111-4111-8111-111111111111"
const form=(file)=>{const f=new FormData();f.set("event_id",event);f.set("file",file);return f}
function request(path,body,headers={}){return new Request(origin+path,{method:"POST",body,
 headers:{Origin:origin,"Sec-Fetch-Site":"same-origin",...headers}})}
function db(approved=true,admin=true){
 const calls=[]
 return {calls,rpc:async(name,args)=>{
  calls.push({name,args})
  if(name==="upt_is_approved")return {data:approved,error:null}
  if(name==="upt_is_admin")return {data:admin,error:null}
  if(name==="upt_guestlist_import")return {data:{inserted:args.p_entries.length,duplicates:0,supplemented:0},error:null}
  throw Error("unexpected SQL "+name)
 }}
}
test("source guestlist route is truly native and retains all 64 source API routes",()=>{
 assert.equal(report.originalSourceRoutes,64)
 assert.ok(!report.pending.some(x=>x.includes("guestlist/import")))
 assert.equal(report.allOriginalPairsAccountedFor,true)
 assert.equal(report.fullCutoverAllowed,false)
})
test("original CSV/TXT import preserves Dutch headers, artist/drinks and SQL event boundary",async()=>{
 const file=new File(["artiest;plaatsen;drank;backstage\nDJ Test;2;Water;Quiet room\n"],
  "guests.csv",{type:"text/csv"})
 const f=db()
 const result=await nativeGuestlistImport(f,"11111111-1111-4111-8111-111111111111",request("/api/guestlist/import",form(file)))
 assert.equal(result.status,200)
 assert.deepEqual(await result.json(),{inserted:1,duplicates:0,supplemented:0})
 assert.equal(f.calls.find(x=>x.name==="upt_is_admin").args.uid,"11111111-1111-4111-8111-111111111111")
 assert.equal(f.calls.at(-1).args.p_event,event)
 assert.deepEqual(f.calls.at(-1).args.p_entries,[{name:"DJ Test",type:"artist",
  spots:"2",notes:"",drinks:"Water",hospitality_notes:"Quiet room"}])
})
test("XLSX from original free Worker writer imports locally and without Node ExcelJS",async()=>{
 const bytes=buildXlsx([{name:"Guestlist",rows:[
  ["Naam","Type","Spots","Drinks","Notes"],
  ["Guest One","guest",1,"Water","VIP"],
  ["Artist Two","artist",2,"Tea","Stage"]
 ]}])
 const file=new File([bytes],"guests.xlsx",{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})
 const parsed=await nativeGuestlistXlsx(file)
 assert.equal(parsed.length,2)
 assert.deepEqual(parsed.map(x=>[x.name,x.type,x.spots]),[
  ["Guest One","guest","1"],["Artist Two","artist","2"]])
 const f=db()
 const result=await nativeGuestlistImport(f,"11111111-1111-4111-8111-111111111111",request("/api/guestlist/import",form(file)))
 assert.equal(result.status,200)
 assert.equal(f.calls.at(-1).args.p_entries.length,2)
})
test("signed SQL privilege is required before parsing bytes, AI or import",async()=>{
 const disabled=db(false,true)
 const result=await nativeGuestlistImport(disabled,"11111111-1111-4111-8111-111111111111",request("/api/guestlist/import",
  form(new File(["name\nTest"],"list.csv",{type:"text/csv"}))))
 assert.equal(result.status,403)
 assert.deepEqual(disabled.calls.map(x=>x.name),["upt_is_approved","upt_is_admin"])
 const hostile=db()
 const r=await nativeGuestlistImport(hostile,"11111111-1111-4111-8111-111111111111",request("/api/guestlist/import",
  form(new File(["name\nTest"],"list.csv",{type:"text/csv"})),{Origin:"https://evil.invalid"}))
 assert.equal(r.status,403);assert.equal(hostile.calls.length,0)
})
test("rich document AI extraction requires source schema, fixed prompt and staff authorization",async()=>{
 const f=db()
 let calls=0
 const ai={toMarkdown:async()=>({format:"text",data:"Artist: DJ B\nDrinks: Water"}),
  run:async(model,input)=>{
   calls++;assert.equal(model,"@cf/meta/llama-3.3-70b-instruct-fp8-fast")
   assert.match(input.messages[0].content,/onbetrouwbare data/)
   return {response:JSON.stringify({entries:[{name:"DJ B",type:"artist",spots:2,
    notes:null,drinks:"Water",hospitality_notes:null}]})}
  }}
 const file=new File(["%PDF-1.4\nfake test"],"guests.pdf",{type:"application/pdf"})
 const result=await nativeGuestlistImport(f,"11111111-1111-4111-8111-111111111111",request("/api/guestlist/import",form(file)),ai)
 assert.equal(result.status,200);assert.equal(calls,1)
 assert.equal(f.calls.at(-1).args.p_entries[0].name,"DJ B")
 const invalid=await nativeGuestlistImport(f,"11111111-1111-4111-8111-111111111111",request("/api/guestlist/import",form(file)),{
  ...ai,run:async()=>({response:JSON.stringify({entries:[{name:"Bad",type:"admin",spots:1000}]})})
 })
 assert.equal(invalid.status,400)
})
test("original native admin login preserves redirect and missing-field error query",async()=>{
 const native={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_admin-fixture",
  MAIN_AUTH_RUNTIME:{runtimeConfiguration:async()=>({protocol:"main-auth-native-v1",projectUrl:qa,values:{}})}}
 const body=new FormData();body.set("email","");body.set("password","")
 const result=await forwardMainAuth(request("/api/auth/admin-login",body),native)
 assert.equal(result.status,303)
 assert.match(result.headers.get("location"),/uptilldawn-modern-main.*\/login\/admin\?error=/)
 assert.equal(result.headers.get("x-uptilldawn-auth-runtime"),"native-original-source")
})
test("QA guestlist writes are disabled before original backend, SQL or AI execution",async()=>{
 let calls=0
 const res=await app.request(request("/api/guestlist/import",form(
  new File(["name\nPerson"],"list.csv",{type:"text/csv"}))),{},{
  SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",
  UPT_MIGRATION_ALLOW_WRITES:"false",MAIN_AUTH:{fetch:async()=>{calls++;throw Error("no Main call")}}
 })
 assert.equal(res.status,503)
 assert.deepEqual(await res.json(),{error:"migration_writes_disabled"})
 assert.equal(calls,0)
})

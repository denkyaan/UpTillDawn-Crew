import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativeOriginalBriefingAnalyze} from "../src/api/native-original-briefing-analysis.ts"
import {nativeOriginalAdministrationOcr} from "../src/api/native-original-administration-ocr.ts"
import {nativeMainOcrDiagnostic} from "../src/api/native-original-ocr-diagnostic.ts"
import {report} from "../scripts/legacy-route-audit.mjs"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const uid="11111111-1111-4111-8111-111111111111"
const req=(path,body,headers={})=>new Request(origin+path,{method:"POST",
 headers:{Origin:origin,"Sec-Fetch-Site":"same-origin",...headers},...(body===undefined?{}:{body})})
const fileForm=(name,content,type)=>{const form=new FormData()
 form.set("file",new File([content],name,{type}))
 return form}

test("all three original document routes are registered without Next proxy",()=>{
 for(const path of ["/api/briefing-analyze","/api/administration/ocr",
  "/api/diagnostics/cloudmersive-ocr"]){
  assert.ok(!report.pending.some(x=>x.includes(path+" [")),path)
 }
 assert.equal(report.allOriginalPairsAccountedFor,true)
 assert.equal(report.fullCutoverAllowed,false)
})
test("public QA blocks briefing and OCR before SQL, authentication or provider network",async()=>{
 let requests=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",
  UPT_MIGRATION_ALLOW_WRITES:"false",MAIN_AUTH:{fetch:async()=>{requests++;throw Error("no legacy")}}}
 for(const path of ["/api/briefing-analyze","/api/administration/ocr"]){
  const result=await app.request(req(path,fileForm("document.txt","Hello","text/plain")),{},env)
  assert.equal(result.status,503,path)
  assert.deepEqual(await result.json(),{error:"migration_writes_disabled"})
 }
 assert.equal(requests,0)
})
test("briefing document fallback requires original approved Admin/Responsible and defaults to local only",async()=>{
 const calls=[]
 const db={from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:"admin",approved:true},error:null})})})}),
  rpc:async(name)=>{calls.push(name);return {data:"admin",error:null}}}
 const file=fileForm("briefing.txt","Sound check at 16h","text/plain")
 const disabled=await nativeOriginalBriefingAnalyze(req("/api/briefing-analyze",file),db,uid,{})
 assert.equal(disabled.status,503)
 assert.deepEqual(await disabled.json(),{error:"Externe AI-analyse staat uit. Gebruik de lokale briefingimport."})
 assert.deepEqual(calls,["upt_current_effective_role"])
 const noRole={from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:"staff",approved:true},error:null})})})}),
  rpc:async()=>({data:"staff",error:null})}
 const denied=await nativeOriginalBriefingAnalyze(req("/api/briefing-analyze",fileForm("briefing.txt","Sound check","text/plain")),noRole,uid,
  {UPT_ENABLE_EXTERNAL_BRIEFING_AI:"true",OPENAI_API_KEY:"test"})
 assert.equal(denied.status,403)
 const forbidden=await nativeOriginalBriefingAnalyze(req("/api/briefing-analyze",fileForm("briefing.txt","ok","text/plain"),
  {Origin:"https://hostile.example"}),db,uid,{})
 assert.equal(forbidden.status,403)
 const unsafe=await nativeOriginalBriefingAnalyze(req("/api/briefing-analyze",fileForm("briefing.exe","hi","text/plain")),db,uid,{})
 assert.equal(unsafe.status,400)
})
test("OCR requires same-origin and private configured key, and rejects unsupported file bytes",async()=>{
 const missing=await nativeOriginalAdministrationOcr(req("/api/administration/ocr"),uid)
 assert.equal(missing.status,503)
 assert.deepEqual(await missing.json(),{error:"ocr_not_configured"})
 const hostile=await nativeOriginalAdministrationOcr(req("/api/administration/ocr",undefined,
  {Origin:"https://hostile.example"}),uid,"secret")
 assert.equal(hostile.status,403)
 const malformed=await nativeOriginalAdministrationOcr(req("/api/administration/ocr",
  fileForm("x.pdf","not a PDF","application/pdf")),uid,"secret")
 assert.equal(malformed.status,422)
 assert.deepEqual(await malformed.json(),{error:"invalid_language"})
})
test("deployment diagnostic rejects anonymous browser requests before provider secret and network",async()=>{
 const result=await nativeMainOcrDiagnostic(req("/api/diagnostics/cloudmersive-ocr"))
 assert.equal(result.status,401)
 assert.deepEqual(await result.json(),{status:"unauthorized"})
 const routed=await app.request(req("/api/diagnostics/cloudmersive-ocr"),{},{SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture"})
 assert.equal(routed.status,401)
})
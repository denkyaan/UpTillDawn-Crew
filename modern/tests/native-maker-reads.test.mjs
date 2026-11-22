import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {
 makerReadResponse,godSourceReadResponse,userErrorReportReadResponse
} from "../src/api/native-maker-reads.ts"
import {forwardMainSource} from "../src/api/main-source.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const upstream="https://uptilldawn-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const validId="aaaabbbb-cccc-4ddd-8eee-000000000001"
const cookie="uptilldawn-god-session=maker-token"
const rule={automation_key:"fixture",enabled:true}
const errors=[{id:validId,status:"open"}]
function fixture({valid=true,owner=true,approved=true,role="staff",report=errors}={}){
 const calls=[]
 const db={
  rpc:async(name,args)=>{
   calls.push([name,args])
   switch(name){
    case "upt_god_session_valid":return {data:valid,error:null}
    case "upt_current_is_owner":return {data:owner,error:null}
    case "upt_current_effective_role":return {data:role,error:null}
    case "upt_god_role_rules":return {data:[{feature_key:"chat",visible:true}],error:null}
    case "upt_god_error_reports":return {data:errors,error:null}
    case "upt_god_data_catalog":return {data:[{table:"events"}],error:null}
    case "upt_god_data_rows":return {data:[{id:validId}],error:null}
    case "upt_god_upload_security_audit":return {data:[{status:"clean"}],error:null}
    case "upt_is_approved":return {data:approved,error:null}
    default:throw Error("Unexpected RPC "+name)
   }
  },
  from:table=>{
   calls.push(["from",table])
   if(table==="automation_rules")return {
    select:columns=>{
     calls.push(["select",columns])
     return {order:key=>{calls.push(["order",key]);return Promise.resolve({data:[rule],error:null})}}
    }}
   if(table==="user_error_reports")return {
    select:columns=>{
     calls.push(["select",columns])
     return {eq:(column,id)=>{calls.push(["eq",column,id]);
      return {maybeSingle:async()=>({data:report[0]??null,error:null})}}}
    }}
   throw Error("Unexpected table "+table)
  }
 }
 return {db,calls}
}
function get(path,headers={}){return new Request(origin+path,{headers})}
test("Maker studio always requires original God cookie AND signed upt_god_session_valid RPC",async()=>{
 const empty=fixture()
 const missing=await makerReadResponse(empty.db,get("/api/god/rules?role=staff"),"","/api/god/rules")
 assert.equal(missing.status,401)
 assert.deepEqual(await missing.json(),{error:"Meld opnieuw aan bij God Mode."})
 assert.deepEqual(empty.calls,[])
 const invalid=fixture({valid:false})
 const denied=await makerReadResponse(invalid.db,get("/api/god/rules?role=staff"),cookie,"/api/god/rules")
 assert.equal(denied.status,401)
 assert.deepEqual(await denied.json(),{error:"God Mode sessie verlopen."})
 assert.deepEqual(invalid.calls,[["upt_god_session_valid",{p_token:"maker-token"}]])
 const wrongOrigin=fixture()
 const blocked=await makerReadResponse(wrongOrigin.db,get("/api/god/data",{Origin:"https://attacker.invalid"}),cookie,"/api/god/data")
 assert.equal(blocked.status,403)
 assert.deepEqual(wrongOrigin.calls,[])
})
test("God Mode role rules preserve validation, RLS token and original JSON",async()=>{
 const f=fixture()
 const res=await makerReadResponse(f.db,get("/api/god/rules?role=admin"),cookie,"/api/god/rules")
 assert.equal(res.status,200)
 assert.deepEqual(await res.json(),{rules:[{feature_key:"chat",visible:true}]})
 assert.deepEqual(f.calls,[
  ["upt_god_session_valid",{p_token:"maker-token"}],
  ["upt_god_role_rules",{p_token:"maker-token",p_role:"admin"}]
 ])
 const broken=await makerReadResponse(fixture().db,get("/api/god/rules?role=god"),cookie,"/api/god/rules")
 assert.equal(broken.status,400)
 assert.deepEqual(await broken.json(),{error:"Ongeldige rol."})
})
test("Maker automation rules and preview role never trust browser-supplied role or owner",async()=>{
 const f=fixture()
 const res=await makerReadResponse(f.db,get("/api/god/automation-rules"),cookie,"/api/god/automation-rules")
 assert.equal(res.status,200)
 assert.deepEqual(await res.json(),{rules:[rule]})
 assert.deepEqual(f.calls.map(x=>x[0]),[
  "upt_god_session_valid","upt_current_is_owner","from","select","order"
 ])
 const denied=fixture({owner:false})
 const r=await makerReadResponse(denied.db,get("/api/god/preview-role"),cookie,"/api/god/preview-role")
 assert.equal(r.status,403)
 assert.deepEqual(await r.json(),{error:"Alleen de maker kan rolvoorbeelden openen."})
 assert.ok(!denied.calls.some(x=>x[0]==="upt_current_effective_role"))
 const allowed=fixture({role:"responsible_lead"})
 const yes=await makerReadResponse(allowed.db,get("/api/god/preview-role"),cookie,"/api/god/preview-role")
 assert.deepEqual(await yes.json(),{role:"responsible_lead"})
})
test("Maker data catalog, bounded row offset and error summary are token-scoped",async()=>{
 const f=fixture()
 const catalog=await makerReadResponse(f.db,get("/api/god/data"),cookie,"/api/god/data")
 assert.deepEqual(await catalog.json(),{data:[{table:"events"}]})
 const rows=await makerReadResponse(f.db,get("/api/god/data?table=events&offset=14"),cookie,"/api/god/data")
 assert.deepEqual(await rows.json(),{data:[{id:validId}]})
 assert.ok(f.calls.some(([name,args])=>name==="upt_god_data_rows"&&args.p_offset===14&&args.p_table==="events"))
 const tooLarge=fixture()
 const invalid=await makerReadResponse(tooLarge.db,get("/api/god/data?table=events&offset=100001"),cookie,"/api/god/data")
 assert.equal(invalid.status,500)
 assert.equal(tooLarge.calls.filter(x=>x[0]==="upt_god_data_rows").length,0)
 const report=fixture()
 const status=await makerReadResponse(report.db,get("/api/god/error-reports?limit=500"),cookie,"/api/god/error-reports")
 assert.deepEqual(await status.json(),{reports:errors})
 assert.ok(report.calls.some(([name,args])=>name==="upt_god_error_reports"&&args.p_limit===100))
})
test("legacy God view DTO requires owner, rejects unknown RPC, keeps no-token fallback",async()=>{
 const denied=fixture({owner:false})
 const noOwner=await godSourceReadResponse(denied.db,cookie,["upt_god_session_valid"])
 assert.equal(noOwner.status,403)
 assert.deepEqual(await noOwner.json(),{error:"view_data_unavailable"})
 const bad=await godSourceReadResponse(fixture().db,cookie,["upt_god_repository_secret"])
 assert.equal(bad.status,400)
 const missing=await godSourceReadResponse(fixture().db,"",["upt_god_upload_security_audit"])
 assert.deepEqual(await missing.json(),{value:{data:[],error:null}})
 const missingValidity=await godSourceReadResponse(fixture().db,"",["upt_god_session_valid"])
 assert.deepEqual(await missingValidity.json(),{value:{data:false,error:null}})
 const ok=fixture()
 const audit=await godSourceReadResponse(ok.db,cookie,["upt_god_upload_security_audit"])
 assert.deepEqual(await audit.json(),{value:{data:[{status:"clean"}],error:null}})
 assert.deepEqual(ok.calls.at(-1),["upt_god_upload_security_audit",{p_token:"maker-token",p_limit:200}])
})
test("error report GET preserves original approval, UUID and private RLS result",async()=>{
 const no=fixture({approved:false})
 const rejected=await userErrorReportReadResponse(no.db,get("/api/error-reports?id="+validId))
 assert.equal(rejected.status,401)
 assert.deepEqual(await rejected.json(),{error:"Aanmelden vereist."})
 assert.ok(!no.calls.some(x=>x[0]==="from"))
 const f=fixture()
 const good=await userErrorReportReadResponse(f.db,get("/api/error-reports?id="+validId))
 assert.equal(good.status,200)
 assert.deepEqual(await good.json(),{report:errors[0]})
 assert.equal(good.headers.get("cache-control"),"no-store")
 assert.deepEqual(f.calls.filter(x=>x[0]==="eq"),[["eq","id",validId]])
 const malformed=await userErrorReportReadResponse(fixture().db,get("/api/error-reports?id=../etc"))
 assert.equal(malformed.status,400)
 assert.deepEqual(await malformed.json(),{error:"Ongeldig foutrapport."})
 const cross=await userErrorReportReadResponse(fixture().db,get("/api/error-reports?id="+validId,{"Sec-Fetch-Site":"cross-site"}))
 assert.equal(cross.status,403)
 const empty=await userErrorReportReadResponse(fixture({report:[]}).db,get("/api/error-reports?id="+validId))
 assert.equal(empty.status,404)
})
test("the seven newly native GET and read DTO endpoints deny anonymous calls without touching legacy backend",async()=>{
 let legacy=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_test",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{legacy++;return Response.json({value:"leaked"})}}}
 for(const path of ["/api/god/automation-rules","/api/god/preview-role","/api/god/rules?role=admin",
  "/api/god/data","/api/god/error-reports","/api/error-reports?id="+validId]){
  const r=await app.request(origin+path,{},env)
  assert.equal(r.status,401,path)
 }
 const dto=await app.request(origin+"/api/migration/view-data",{
  method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},
  body:JSON.stringify({id:"god-session-rpc",args:["upt_god_session_valid"]})
 },env)
 assert.equal(dto.status,401)
 assert.equal(legacy,0)
})
test("miswired Main service binding terminates at first bridge hop instead of recursively exhausting Workers Free",async()=>{
 let calls=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_test",
  UPT_MIGRATION_ALLOW_WRITES:"true",
  MAIN_AUTH:{fetch:async r=>{
   calls++
   assert.equal(new URL(r.url).origin,upstream)
   assert.equal(r.headers.get("x-uptilldawn-main-bridge"),"original-read-v1")
   // The future rebranded Main Hono would receive the marked service call.
   return app.request(r,{},env)
  }}
 }
 const request=new Request(origin+"/api/migration/actions",{
  method:"POST",headers:{"Origin":origin,"Content-Type":"application/json"},body:"{}"
 })
 const result=await forwardMainSource(request,env)
 assert.equal(result.status,508)
 assert.deepEqual(await result.json(),{error:"main_backend_recursion_blocked"})
 assert.equal(calls,1)
 const direct=await app.request(origin+"/api/v1/health",{headers:{"X-UpTillDawn-Main-Bridge":"original-read-v1"}},env)
 assert.equal(direct.status,508)
})

import test from "node:test"
import assert from "node:assert/strict"
import {nativeOriginalProviderOAuth,nativeOriginalWeeztixOAuth}
 from "../src/api/native-original-provider-oauth.ts"
import {report} from "../scripts/legacy-route-audit.mjs"
import app from "../src/api/worker.ts"
import {sealOAuthToken,openOAuthToken} from "../src/api/provider-oauth.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const user="11111111-1111-4111-8111-111111111111"
const event="22222222-2222-4222-8222-222222222222"
const key=btoa("a".repeat(32))
const env={
 UPT_INTEGRATION_ENCRYPTION_KEY:key,
 UPT_MIGRATION_OAUTH_ENABLED:"true",
 UPT_PROVIDER_OAUTH_ORIGIN:origin,
 UPT_WEEZTIX_OAUTH_ORIGIN:origin,
 UPT_SUMUP_OAUTH_CLIENT_ID:"sumup-app",
 UPT_SUMUP_OAUTH_CLIENT_SECRET:"sumup-secret-123456789",
 UPT_BILLIT_OAUTH_CLIENT_ID:"billit-app",
 UPT_BILLIT_OAUTH_CLIENT_SECRET:"billit-secret-123456789"
}
const req=(path,cookie)=>new Request(origin+path,{headers:cookie?{Cookie:cookie}:{}})
function fixture({permission=true,vault=null}={}){
 const calls=[]
 const db={
  rpc:async(name,args)=>{
   calls.push({name,args})
   if(name==="upt_can_manage_integrations")return {data:permission,error:null}
   if(name==="upt_integration_credentials"&&args.p_action==="read")
    return {data:vault||{configured:false},error:null}
   if(name==="upt_integration_credentials"&&args.p_action==="save")
    return {data:{configured:true},error:null}
   throw Error("unexpected "+name)
  },
  from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:event},error:null})})})})
 }
 return {db,calls}
}
test("all four original OAuth GET routes are explicitly native rather than proxied",()=>{
 for(const path of ["integrations/oauth/[^/]+/start",
  "integrations/oauth/[^/]+/callback","integrations/weeztix/start",
  "integrations/weeztix/callback"]){
  assert.ok(report.pending.every(p=>!p.includes(path)),path)
 }
 assert.equal(report.allOriginalPairsAccountedFor,true)
 assert.equal(report.fullCutoverAllowed,false)
})
test("source OAuth consent requires Administration business integration permission",async()=>{
 for(const kind of ["sumup","peppol"]){
  const f=fixture({permission:false})
  const res=await nativeOriginalProviderOAuth(f.db,user,req(
   "/api/administration/integrations/oauth/"+kind+"/start"
  ),env,kind,"start")
  assert.equal(res.status,403)
  assert.deepEqual(f.calls.map(x=>x.name),["upt_can_manage_integrations"])
 }
 const f=fixture()
 const unsupported=await nativeOriginalProviderOAuth(f.db,user,req(
  "/api/administration/integrations/oauth/wrong/start"),env,"wrong","start")
 assert.equal(unsupported.status,404)
 assert.equal(f.calls.length,0)
})
test("two external provider OAuth starts bind signed user, exact callback and secure state",async()=>{
 for(const kind of ["sumup","peppol"]){
  const f=fixture()
  const res=await nativeOriginalProviderOAuth(f.db,user,req(
   "/api/administration/integrations/oauth/"+kind+"/start"),env,kind,"start")
  assert.equal(res.status,303)
  const url=new URL(res.headers.get("location"))
  assert.equal(url.searchParams.get("redirect_uri"),origin+
   "/api/administration/integrations/oauth/"+kind+"/callback")
  const state=url.searchParams.get("state")
  assert.match(state,/^[0-9a-f]{64}$/)
  const cookie=res.headers.get("set-cookie")
  assert.ok(cookie.includes("upt_provider_oauth_"+kind+"_state="+state+":"+user))
  assert.match(cookie,/HttpOnly; Secure; SameSite=Lax; Max-Age=600/)
  assert.equal(f.calls.length,1)
  const expired=await nativeOriginalProviderOAuth(f.db,user,req(
   "/api/administration/integrations/oauth/"+kind+"/callback?state="+state+"&code=valid-code",
   "upt_provider_oauth_"+kind+"_state="+"f".repeat(64)+":"+user
  ),env,kind,"callback")
  assert.equal(expired.status,303)
  assert.match(expired.headers.get("location"),new RegExp(kind+"_oauth=expired"))
  assert.match(expired.headers.get("set-cookie"),/Max-Age=0/)
  assert.ok(!f.calls.some(x=>x.args?.p_action==="save"))
 }
})
test("callback rejects mismatched authenticated user without fetching OAuth token",async()=>{
 const f=fixture()
 const provider="sumup",s="a".repeat(64)
 const response=await nativeOriginalProviderOAuth(f.db,user,req(
  "/api/administration/integrations/oauth/sumup/callback?state="+s+"&code=valid-code",
  "upt_provider_oauth_sumup_state="+s+":"+"3".repeat(36)
 ),env,provider,"callback")
 assert.equal(response.status,303)
 assert.match(response.headers.get("location"),/sumup_oauth=expired/)
 assert.equal(f.calls.length,1)
})
test("Weeztix start denies unknown event, unconfigured app and forged callback context",async()=>{
 const base={...env,UPT_WEEZTIX_OAUTH_CLIENT_ID:"weeztix-app",
  UPT_WEEZTIX_OAUTH_CLIENT_SECRET:"weeztix-secret-long"}
 const f=fixture()
 const invalid=await nativeOriginalWeeztixOAuth(f.db,user,req(
  "/api/administration/integrations/weeztix/start?eventId=bad"),base,"start")
 assert.equal(invalid.status,422)
 const callback=await nativeOriginalWeeztixOAuth(f.db,user,req(
  "/api/administration/integrations/weeztix/callback?state="+("a".repeat(64)),
  "upt_weeztix_oauth_state="+("a".repeat(64))+":"+user+":fake-event"
 ),base,"callback")
 assert.equal(callback.status,303)
 assert.match(callback.headers.get("location"),/weeztix_oauth=expired/)
 assert.ok(!f.calls.some(x=>x.args?.p_action==="save"))
 const start=await nativeOriginalWeeztixOAuth(f.db,user,req(
  "/api/administration/integrations/weeztix/start?eventId="+event),base,"start")
 assert.equal(start.status,303)
 assert.equal(new URL(start.headers.get("location")).searchParams.get("redirect_uri"),
  origin+"/api/administration/integrations/weeztix/callback")
 assert.match(start.headers.get("set-cookie"),/HttpOnly; Secure; SameSite=Lax/)
})
test("integration ciphertext uses original provider-bound AES-GCM storage format",async()=>{
 const cipher=await sealOAuthToken("weeztix",{
  WEEZTIX_ACCESS_TOKEN:"example-valid-token-123",WEEZTIX_SCANNING_ENABLED:"true",
  WEEZTIX_ACTIVE_EVENT_ID:event,WEEZTIX_CLIENT_ID:"client-id-123",
  WEEZTIX_CLIENT_SECRET:"client-secret-123"
 },key)
 const unpacked=await openOAuthToken("weeztix",cipher,key)
 assert.equal(unpacked.WEEZTIX_ACTIVE_EVENT_ID,event)
 await assert.rejects(openOAuthToken("sumup",cipher,key))
})
test("QA gates block all original provider OAuth starts and callbacks before legacy, SQL or provider I/O",async()=>{
 let legacyCalls=0
 const qa={
  SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_fixture",
  UPT_MIGRATION_ALLOW_WRITES:"false",UPT_MIGRATION_OAUTH_ENABLED:"false",
  MAIN_AUTH:{fetch:async()=>{legacyCalls++;throw Error("no legacy call")}}
 }
 for(const path of [
  "/api/administration/integrations/oauth/sumup/start",
  "/api/administration/integrations/oauth/sumup/callback",
  "/api/administration/integrations/oauth/peppol/start",
  "/api/administration/integrations/oauth/peppol/callback",
  "/api/administration/integrations/weeztix/start",
  "/api/administration/integrations/weeztix/callback"
 ]){
  const result=await app.request(origin+path,{},qa)
  assert.equal(result.status,503,path)
  assert.deepEqual(await result.json(),{error:"migration_writes_disabled"})
 }
 assert.equal(legacyCalls,0)
})

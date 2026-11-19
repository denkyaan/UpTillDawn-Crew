import test from "node:test"
import assert from "node:assert/strict"
import {
 oauthOrigin,oauthReady,validMasterKey,authorizationUrl,oauthCookieName,
 startOAuthState,verifyOAuthState,clearOAuthCookie,sealOAuthToken,openOAuthToken,
 parseToken,tokenConfiguration
} from "../src/api/provider-oauth.ts"
import {readFileSync} from "node:fs"
const secret=Buffer.alloc(32,67).toString("base64")
const uid="12345678-1234-4234-8234-123456789012"
const origin="https://modern.example.test"
const valid={UPT_MIGRATION_OAUTH_ENABLED:"true",UPT_PROVIDER_OAUTH_ORIGIN:origin,
 UPT_INTEGRATION_ENCRYPTION_KEY:secret,UPT_SUMUP_OAUTH_CLIENT_ID:"sumup-client",
 UPT_SUMUP_OAUTH_CLIENT_SECRET:"sumup-top-secret",
 UPT_BILLIT_OAUTH_CLIENT_ID:"billit-client",UPT_BILLIT_OAUTH_CLIENT_SECRET:"billit-top-secret",
 UPT_BILLIT_OAUTH_ENV:"sandbox"}
test("OAuth does not activate without operator settings, exact origin and secure master key",()=>{
 assert.equal(validMasterKey(secret),true)
 assert.equal(validMasterKey("not-base64"),false)
 assert.equal(oauthReady(valid,"sumup",origin+"/api/x"),true)
 assert.equal(oauthReady({...valid,UPT_MIGRATION_OAUTH_ENABLED:"false"},"sumup",origin+"/api/x"),false)
 assert.equal(oauthReady({...valid,UPT_INTEGRATION_ENCRYPTION_KEY:"a"},"sumup",origin+"/api/x"),false)
 assert.equal(oauthReady({...valid,UPT_SUMUP_OAUTH_CLIENT_SECRET:""},"sumup",origin+"/api/x"),false)
 assert.equal(oauthReady(valid,"sumup","https://attacker.example/api/x"),false)
 assert.equal(oauthOrigin({...valid,UPT_PROVIDER_OAUTH_ORIGIN:origin+"/evil"},origin+"/api"),null)
 assert.equal(oauthReady({...valid,UPT_BILLIT_OAUTH_ENV:"invalid"},"peppol",origin+"/api"),false)
})
test("provider authorization redirects are fixed allowlisted HTTPS hosts; client secret is never in URL",()=>{
 const state="b".repeat(64)
 const sumup=new URL(authorizationUrl(valid,"sumup",origin,state))
 assert.equal(sumup.origin,"https://api.sumup.com")
 assert.equal(sumup.searchParams.get("redirect_uri"),origin+"/integrations/oauth/callback/sumup")
 assert.equal(sumup.searchParams.get("scope"),"transactions.history user.profile_readonly")
 assert.equal(sumup.searchParams.get("response_type"),"code")
 assert.ok(!sumup.href.includes("sumup-top-secret"))
 const billit=new URL(authorizationUrl(valid,"peppol",origin,state))
 assert.equal(billit.origin,"https://my.sandbox.billit.be")
 assert.equal(billit.searchParams.get("redirect_uri"),origin+"/integrations/oauth/callback/peppol")
 assert.ok(!billit.href.includes("billit-top-secret"))
 assert.throws(()=>authorizationUrl(valid,"sumup",origin,"/malicious"))
})
test("OAuth state cookie is signed, HttpOnly, actor-bound, provider-bound and expires",async()=>{
 const now=1795095000000
 const session=await startOAuthState("sumup",uid,secret,now)
 const value=session.cookie.split(";")[0]
 assert.match(value,new RegExp("^"+oauthCookieName("sumup")+"="))
 assert.ok(session.cookie.includes("HttpOnly; Secure; SameSite=Lax; Max-Age=600"))
 assert.equal(await verifyOAuthState("sumup",uid,secret,value,session.state,now+1000),true)
 assert.equal(await verifyOAuthState("peppol",uid,secret,value,session.state,now+1000),false)
 assert.equal(await verifyOAuthState("sumup","00000000-0000-4000-8000-000000000000",secret,value,session.state,now+1000),false)
 assert.equal(await verifyOAuthState("sumup",uid,secret,value,"a".repeat(64),now+1000),false)
 assert.equal(await verifyOAuthState("sumup",uid,secret,value,session.state,now+601000),false)
 assert.equal(await verifyOAuthState("sumup",uid,secret,value+"; "+value,session.state,now),false)
 const tampered=value.replace(/.$/,"0")
 assert.equal(await verifyOAuthState("sumup",uid,secret,tampered,session.state,now+1000),false)
 assert.ok(clearOAuthCookie("sumup").includes("Max-Age=0"))
})
test("AES-256-GCM ciphertext preserves existing v1 schema, hides secrets and binds provider",async()=>{
 const token={SUMUP_OAUTH_ACCESS_TOKEN:"secret-access-token",
  SUMUP_OAUTH_REFRESH_TOKEN:"secret-refresh-token",SUMUP_OAUTH_EXPIRES_AT:"1795100000"}
 const sealed=await sealOAuthToken("sumup",token,secret)
 assert.match(sealed,/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/)
 assert.ok(!sealed.includes("secret-access"))
 assert.deepEqual(await openOAuthToken("sumup",sealed,secret),token)
 await assert.rejects(()=>openOAuthToken("peppol",sealed,secret))
 await assert.rejects(()=>openOAuthToken("sumup",sealed,Buffer.alloc(32,68).toString("base64")))
 assert.notEqual(await sealOAuthToken("sumup",token,secret),sealed)
})
test("provider token schema is bounded and only contains reviewed storage fields",()=>{
 const parsed=parseToken({token_type:"Bearer",access_token:"access-token-valid",refresh_token:"refresh-token-valid",expires_in:3600},1795095000000)
 assert.deepEqual(parsed,{access:"access-token-valid",refresh:"refresh-token-valid",expires:String(1795095000+3570)})
 assert.deepEqual(Object.keys(tokenConfiguration("sumup",parsed,valid)).sort(),
  ["SUMUP_OAUTH_ACCESS_TOKEN","SUMUP_OAUTH_EXPIRES_AT","SUMUP_OAUTH_REFRESH_TOKEN"])
 assert.equal(tokenConfiguration("peppol",parsed,valid).BILLIT_OAUTH_ENV,"sandbox")
 for(const data of [
  {access_token:"valid-access-xx",refresh_token:"good-refresh-xxx",expires_in:3599,token_type:"Basic"},
  {access_token:"a",refresh_token:"good-refresh-xxx",expires_in:3599},
  {access_token:"valid-access-xx",refresh_token:"good-refresh-xxx",expires_in:59},
  {access_token:"valid-access-xx",refresh_token:"good-refresh-xxx",expires_in:"3600"},
 ])assert.equal(parseToken(data),null)
})
test("client never sees or stores operator OAuth secrets, start/complete need JWT and gate",()=>{
 const worker=readFileSync(new URL("../src/api/worker.ts",import.meta.url),"utf8")
 const client=readFileSync(new URL("../src/components/integration-status.tsx",import.meta.url),"utf8")
 const callback=readFileSync(new URL("../src/screens/provider-oauth-callback.tsx",import.meta.url),"utf8")
 assert.ok(worker.includes('app.post("/api/v1/integrations/oauth/start"'))
 assert.ok(worker.includes('app.post("/api/v1/integrations/oauth/complete"'))
 assert.ok(worker.includes('const actor=await managedOauthActor(c)'))
 assert.ok(worker.includes('c.req.header("Origin")!==origin'))
 assert.ok(worker.includes('rpc("upt_integration_credentials",{'))
 assert.ok(!client.includes("CLIENT_SECRET"))
 assert.ok(!callback.includes("CLIENT_SECRET"))
 assert.ok(callback.includes("window.history.replaceState"))
 assert.ok(callback.includes("protectedCandidatePost"))
 assert.ok(client.includes("MIGRATION_WRITES_ENABLED&&state.oauthReady"))
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8")
 assert.ok(html.includes('<meta name="referrer" content="no-referrer"/>'))
})

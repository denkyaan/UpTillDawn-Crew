import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {nativeOriginalAuth} from '../src/api/native-auth.ts'
import {NativeCookies,withNativeAuth,cookies,nativeEnvironment} from '../src/api/native-auth-context.ts'
import {mainAuthRuntimeConfiguration,MAIN_QA_PROJECT} from '../../lib/migration/main-auth-runtime-config.ts'
const origin='https://uptilldawn-main.uptilldawn.workers.dev',key='sb_publishable_native-auth-fixture'
const binding={runtimeConfiguration:async()=>mainAuthRuntimeConfiguration({})}
const uid='00000000-0000-4000-8000-000000000001'
const jwt=[{alg:'HS256',typ:'JWT'},{sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.c3ludGhldGlj'
function request(path='/api/auth/portal-login',fields={portal:'staff',email:'fixture@example.invalid',password:'synthetic-password'}){const body=new FormData();for(const [name,value]of Object.entries(fields))body.set(name,value);return new Request(origin+path,{method:'POST',headers:{Origin:origin,'Sec-Fetch-Site':'same-origin'},body})}
test('native authentication compiles the original bounded routes without a Next or React runtime',async()=>{
 const code=readFileSync(new URL('../src/api/native-auth.generated.mjs',import.meta.url),'utf8')
 assert.doesNotMatch(code,/(?:from|import\s*\()\s*['"](?:next(?:\/|['"])|react|server-only)|process\.env/)
 const result=await nativeOriginalAuth(request(undefined,{portal:'staff',email:'',password:''}),binding,key)
 assert.equal(result.status,200);assert.equal(result.headers.get('x-uptilldawn-auth-runtime'),'native-original-source')
 assert.deepEqual(await result.json(),{error:'E-mail en wachtwoord zijn verplicht.'})
 const invalid=await nativeOriginalAuth(request('/api/auth/account-action',{_action:'executeSql'}),binding,key)
 assert.equal(invalid.status,400)
 const foreign=request();foreign.headers.set('Origin','https://foreign.invalid')
 assert.equal((await nativeOriginalAuth(foreign,binding,key)).status,403)
 const callback=await nativeOriginalAuth(new Request(origin+'/auth/callback?error=denied'),binding,key)
 assert.equal(callback.status,307);assert.match(callback.headers.get('location'),/\/verify-email\?/)
})
test('private auth configuration excludes DB/production/provider/deployment authority and rejects the wrong project',()=>{
 const config=mainAuthRuntimeConfiguration({RESEND_API_KEY:'synthetic-private-mail-value',SUPABASE_SERVICE_ROLE_KEY:'not-allowed',CLOUDFLARE_API_TOKEN:'not-allowed',UPT_INTEGRATION_ENCRYPTION_KEY:'not-allowed'})
 assert.deepEqual(Object.keys(config.values),['RESEND_API_KEY'])
 assert.equal(config.projectUrl,MAIN_QA_PROJECT)
 assert.throws(()=>mainAuthRuntimeConfiguration({NEXT_PUBLIC_SUPABASE_URL:'https://production.invalid'}))
})
test('concurrent auth requests keep cookies and environment isolated across awaited work',async()=>{
 const gate=[]
 const read=(name)=>withNativeAuth(new Request(origin,{headers:{Cookie:'actor='+name}}),{actor:name},async()=>{
  await new Promise(resolve=>{gate.push(resolve);if(gate.length===2)for(const next of gate)next()})
  assert.equal((await cookies()).get('actor').value,name);assert.equal(nativeEnvironment().actor,name)
  ;(await cookies()).set('result',name,{httpOnly:true,secure:true,sameSite:'lax'})
  const headers=new Headers();(await cookies()).appendTo(headers);return headers.getSetCookie()
 })
 const [a,b]=await Promise.all([read('one'),read('two')])
 assert.match(a[0],/result=one/);assert.match(b[0],/result=two/)
 assert.throws(()=>nativeEnvironment(),/scope missing/)
 const jar=new NativeCookies('preference=account%3Apromotion');assert.equal(jar.get('preference').value,'account:promotion');jar.delete('preference');assert.equal(jar.get('preference'),undefined)
})
test('all five native login paths use password authentication, verified profile/owner/role RPCs and original cookies',async()=>{
 const previous=globalThis.fetch,originalError=console.error
 console.error=(...args)=>{if(args[0]!=='[security-email] RESEND_API_KEY ontbreekt')originalError(...args)}
 try{
  for(const portal of ['staff','responsible','admin','promotion','administration']){
   const calls=[],role=portal==='admin'?'admin':portal==='responsible'?'responsible_lead':'staff'
   globalThis.fetch=async(input,init)=>{
    const req=new Request(input,init),url=new URL(req.url);assert.equal(url.origin,MAIN_QA_PROJECT);calls.push(url.pathname)
    if(url.pathname==='/auth/v1/token')return Response.json({access_token:jwt,token_type:'bearer',refresh_token:'synthetic-refresh',expires_in:3600,user:{id:uid,email:'fixture@example.invalid',app_metadata:{},user_metadata:{}}})
    assert.equal(req.headers.get('authorization'),'Bearer '+jwt)
    if(url.pathname.endsWith('/upt_current_profile'))return Response.json([{id:uid,full_name:'Fixture',approved:true,account_blocked:false,role}])
    if(url.pathname.endsWith('/upt_current_is_owner'))return Response.json(false)
    if(url.pathname.endsWith('/upt_my_portal_assignments'))return Response.json([{portal,role:portal==='promotion'?'promoter':'administrative_staff',approved:true,revoked_at:null}])
    if(url.pathname.endsWith('/upt_set_admin_role_mode'))return Response.json('admin')
    if(url.pathname.endsWith('/upt_admin_login_success'))return Response.json(true)
    throw Error('Unexpected native authentication request '+url.pathname)
   }
   const result=await nativeOriginalAuth(request(undefined,{portal,email:'fixture@example.invalid',password:'synthetic-password'}),binding,key)
   assert.equal(result.status,200);assert.equal((await result.json()).success,true,portal)
   assert.ok(calls.includes('/auth/v1/token'));assert.ok(calls.includes('/rest/v1/rpc/upt_current_profile'));assert.ok(calls.includes('/rest/v1/rpc/upt_current_is_owner'))
   const chunks=result.headers.getSetCookie();assert.ok(chunks.some(c=>c.startsWith('sb-npbjrtiolqperdgljnhi-auth-token')));assert.ok(chunks.some(c=>c.startsWith('uptilldawn-last-workspace=')))
  }
 }finally{globalThis.fetch=previous;console.error=originalError}
})
test('native auth denies missing portal rights and blocked accounts, and clears each failed session',async()=>{
 const previous=globalThis.fetch,originalError=console.error
 console.error=(...args)=>{if(args[0]!=='[security-email] RESEND_API_KEY ontbreekt')originalError(...args)}
 try{
  for(const [portal,blocked,expected]of [['admin',false,'wrong_portal'],['responsible',false,'wrong_portal'],['promotion',false,'wrong_portal'],['administration',false,'wrong_portal'],['staff',true,'account_blocked']]){
   let signouts=0
   globalThis.fetch=async(input,init)=>{
    const req=new Request(input,init),url=new URL(req.url);assert.equal(url.origin,MAIN_QA_PROJECT)
    if(url.pathname==='/auth/v1/token')return Response.json({access_token:jwt,token_type:'bearer',refresh_token:'synthetic-refresh',expires_in:3600,user:{id:uid,email:'fixture@example.invalid',app_metadata:{},user_metadata:{}}})
    if(url.pathname==='/auth/v1/logout'){signouts++;return new Response(null,{status:204})}
    if(url.pathname.endsWith('/upt_current_profile'))return Response.json([{id:uid,full_name:'Fixture',approved:true,account_blocked:blocked,role:'staff'}])
    if(url.pathname.endsWith('/upt_current_is_owner'))return Response.json(false)
    if(url.pathname.endsWith('/upt_my_portal_assignments'))return Response.json([])
    throw Error('Unexpected denied authentication request '+url.pathname)
   }
   const result=await nativeOriginalAuth(request(undefined,{portal,email:'fixture@example.invalid',password:'synthetic-password'}),binding,key)
   assert.equal((await result.json()).code,expected,portal);assert.equal(signouts,1)
   assert.ok(result.headers.getSetCookie().some(c=>c.startsWith('sb-npbjrtiolqperdgljnhi-auth-token=;')&&c.includes('Max-Age=0')))
   assert.ok(result.headers.getSetCookie().every(c=>!c.startsWith('uptilldawn-last-workspace=')))
  }
 }finally{globalThis.fetch=previous;console.error=originalError}
})

test('native Maker sign-in keeps owner authority separate from the permanent staff role across all five portals',async()=>{
 const previous=globalThis.fetch,originalError=console.error
 console.error=(...args)=>{if(args[0]!=='[security-email] RESEND_API_KEY ontbreekt')originalError(...args)}
 try{
  for(const portal of ['staff','responsible','admin','promotion','administration']){
   const roles=[]
   globalThis.fetch=async(input,init)=>{
    const req=new Request(input,init),url=new URL(req.url)
    assert.equal(url.origin,MAIN_QA_PROJECT)
    if(url.pathname==='/auth/v1/token')return Response.json({access_token:jwt,token_type:'bearer',refresh_token:'synthetic-refresh',expires_in:3600,user:{id:uid,email:'fixture@example.invalid',app_metadata:{},user_metadata:{}}})
    assert.equal(req.headers.get('authorization'),'Bearer '+jwt)
    if(url.pathname.endsWith('/upt_current_profile'))return Response.json([{id:uid,full_name:'Maker fixture',approved:true,account_blocked:false,role:'staff'}])
    if(url.pathname.endsWith('/upt_current_is_owner'))return Response.json(true)
    if(url.pathname.endsWith('/upt_set_admin_role_mode')){
     const {p_role}=await req.json();roles.push(p_role);return Response.json(p_role)
    }
    if(url.pathname.endsWith('/upt_admin_login_success'))return Response.json(true)
    throw Error('Unexpected Maker login request '+url.pathname)
   }
   const result=await nativeOriginalAuth(request(undefined,{portal,email:'fixture@example.invalid',password:'synthetic-password'}),binding,key)
   assert.equal(result.status,200)
   const destination=['promotion','administration'].includes(portal)?'/portals/'+portal:'/maker-mode?portal='+portal
   assert.deepEqual(await result.json(),{success:true,redirectTo:destination})
   assert.deepEqual(roles,[['admin','administration'].includes(portal)?'admin':portal==='responsible'?'responsible_lead':'staff'])
   assert.ok(result.headers.getSetCookie().some(c=>c.startsWith('sb-npbjrtiolqperdgljnhi-auth-token')))
   // God authority is issued only after the separate Maker action, never by
   // the normal portal login. No role assignment or real account mutation.
   assert.ok(!result.headers.getSetCookie().some(c=>c.startsWith('uptilldawn-god-session=')))
  }
 }finally{globalThis.fetch=previous;console.error=originalError}
})

test('native auth denies forged Host and cross-site requests before authentication',async()=>{
 const allowed=request(undefined,{portal:'staff',email:'',password:''})
 allowed.headers.set('Host',new URL(origin).host)
 assert.equal((await nativeOriginalAuth(allowed,binding,key)).status,200)
 for(const [host,requestOrigin,site] of [['foreign.invalid','https://foreign.invalid','same-origin'],['foreign.invalid',origin,'same-origin'],[new URL(origin).host,origin,'cross-site']]){
  const wrong=request()
  wrong.headers.set('Host',host);wrong.headers.set('Origin',requestOrigin);wrong.headers.set('Sec-Fetch-Site',site)
  assert.equal((await nativeOriginalAuth(wrong,binding,key)).status,403)
 }
})

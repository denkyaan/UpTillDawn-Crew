import test from 'node:test'
import assert from 'node:assert/strict'
import {forwardMainAuth,MAIN_AUTH_ORIGIN,authResponseCookies} from '../src/api/main-auth.ts'

const origin='https://uptilldawn-modern-main.uptilldawn.workers.dev'
const qa='https://npbjrtiolqperdgljnhi.supabase.co'
function req(path='/api/auth/portal-login',fields={portal:'staff',email:'fixture@example.invalid',password:'synthetic-test-value'},headers={}){
 const body=new FormData()
 for(const [key,value] of Object.entries(fields))body.set(key,value)
 return new Request(origin+path,{method:'POST',body,headers:{Origin:origin,'Sec-Fetch-Site':'same-origin',...headers}})
}
test('all five login portals keep the original Main action result and chunked cookies',async()=>{
 for(const portal of ['staff','responsible','admin','promotion','administration']){
  let calls=0
  const response=await forwardMainAuth(req(undefined,{portal,email:'fixture@example.invalid',password:'synthetic-test-value'},{Cookie:'sb-qa-auth-token.0=fixture','User-Agent':'fixture-browser',Authorization:'Bearer must-not-forward','X-Role':'admin',Host:'attacker.invalid','X-Forwarded-Host':'attacker.invalid','X-Forwarded-Proto':'http'}),{
   SUPABASE_URL:qa,MAIN_AUTH:{async fetch(request){
    calls++
    assert.equal(request.url,MAIN_AUTH_ORIGIN+'/api/auth/portal-login')
    assert.equal(request.headers.get('origin'),MAIN_AUTH_ORIGIN)
    assert.equal(request.headers.get('host'),new URL(MAIN_AUTH_ORIGIN).host)
    assert.equal(request.headers.get('x-forwarded-host'),new URL(MAIN_AUTH_ORIGIN).host)
    assert.equal(request.headers.get('x-forwarded-proto'),'https')
    assert.equal(request.headers.get('cookie'),'sb-qa-auth-token.0=fixture')
    assert.equal(request.headers.get('authorization'),null)
    assert.equal(request.headers.get('x-role'),null)
    assert.equal((await request.formData()).get('portal'),portal)
    const headers=new Headers({'Content-Type':'application/json'})
    headers.append('Set-Cookie','sb-qa-auth-token.0=fixture; Path=/; Secure; SameSite=Lax')
    headers.append('Set-Cookie','sb-qa-auth-token.1=fixture; Path=/; Secure; SameSite=Lax')
    return Response.json({success:true,redirectTo:'/maker-mode?portal='+portal},{headers})
   }},
  })
  assert.equal(calls,1)
  assert.deepEqual(await response.json(),{success:true,redirectTo:'/maker-mode?portal='+portal})
  assert.equal(response.headers.getSetCookie().length,2)
  assert.match(response.headers.get('cache-control'),/no-store/)
 }
})
test('missing binding, wrong host and non-QA database cannot forward authentication',async()=>{
 let called=false
 const binding={fetch:async()=>{called=true;throw Error('must not run')}}
 for(const [request,env] of [
  [req(),{SUPABASE_URL:qa}],
  [req(),{SUPABASE_URL:'https://production.invalid',MAIN_AUTH:binding}],
  [new Request('https://foreign.invalid/api/auth/portal-login',{method:'POST'}),{SUPABASE_URL:qa,MAIN_AUTH:binding}],
 ])assert.equal((await forwardMainAuth(request,env)).status,503)
 assert.equal(called,false)
})
test('Workers getAll preserves distinct session chunks and expiry commas without the Node getSetCookie method',async()=>{
 const cookies=['sb-qa-auth-token.0=fixture; Expires=Wed, 20 Nov 2030 00:00:00 GMT; Path=/','sb-qa-auth-token.1=fixture; Path=/']
 const response=Response.json({success:true,redirectTo:'/admin'})
 Object.defineProperty(response.headers,'getSetCookie',{value:undefined})
 Object.defineProperty(response.headers,'getAll',{value:name=>{assert.equal(name,'Set-Cookie');return cookies}})
 assert.deepEqual(authResponseCookies(response.headers),cookies)
 const result=await forwardMainAuth(req(),{SUPABASE_URL:qa,MAIN_AUTH:{async fetch(){return response}}})
 assert.deepEqual(result.headers.getSetCookie(),cookies)
 const unavailable=new Headers({'Set-Cookie':'fixture=1'})
 Object.defineProperty(unavailable,'getSetCookie',{value:undefined})
 assert.throws(()=>authResponseCookies(unavailable),/UNSUPPORTED_AUTH_COOKIE_API/)
})
test('CSRF, unknown actions, invalid forms and oversized streaming bodies stop before the service',async()=>{
 let calls=0
 const env={SUPABASE_URL:qa,MAIN_AUTH:{async fetch(){calls++;throw Error('must not run')}}}
 const cases=[
  [req(undefined,undefined,{Origin:'https://foreign.invalid'}),403],
  [req(undefined,undefined,{'Sec-Fetch-Site':'cross-site'}),403],
  [req(undefined,{portal:'owner'}),403],
  [req('/api/auth/account-action',{_action:'executeSql'}),400],
  [req('/api/auth/anything'),404],
  [new Request(origin+'/api/auth/portal-login',{method:'GET'}),405],
  [new Request(origin+'/api/auth/portal-login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'}),415],
  [req(undefined,{portal:'staff',password:'x'.repeat(2049)}),413],
  [new Request(origin+'/api/auth/portal-login',{method:'POST',headers:{Origin:origin,'Content-Type':'multipart/form-data; boundary=fixture'},body:new ReadableStream({start(c){c.enqueue(new Uint8Array(16_385));c.close()}}),duplex:'half'}),413],
 ]
 for(const [request,status] of cases)assert.equal((await forwardMainAuth(request,env)).status,status)
 assert.equal(calls,0)
})
test('role denials and deletion cookies survive unchanged, upstream outages are never invalid credentials',async()=>{
 const response=await forwardMainAuth(req(),{SUPABASE_URL:qa,MAIN_AUTH:{async fetch(){return Response.json({error:'Denied',code:'wrong_portal'},{headers:{'Set-Cookie':'sb-qa-auth-token=; Max-Age=0; Path=/'}})}}})
 assert.deepEqual(await response.json(),{error:'Denied',code:'wrong_portal'})
 assert.match(response.headers.get('set-cookie'),/Max-Age=0/)
 for(const fetch of [async()=>{throw Error('offline')},async()=>new Response('<html>1102</html>',{status:503})]){
  const unavailable=await forwardMainAuth(req(),{SUPABASE_URL:qa,MAIN_AUTH:{fetch}})
  assert.equal(unavailable.status,503)
  assert.equal((await unavailable.json()).code,'auth_temporarily_unavailable')
 }
})
test('PKCE account callbacks are fixed to this candidate and callback responses cannot leave its origin',async()=>{
 const response=await forwardMainAuth(req('/api/auth/account-action',{_action:'forgotPassword',_callback_origin:'https://attacker.invalid'}),{SUPABASE_URL:qa,MAIN_AUTH:{async fetch(request){
  assert.equal((await request.formData()).get('_callback_origin'),origin)
  return Response.json({error:'Callback not verified',code:'email_callback_not_verified'},{status:503})
 }}})
 assert.equal(response.status,503)
 for(const [location,status] of [[MAIN_AUTH_ORIGIN+'/auth/reset-password',302],['https://attacker.invalid',502]]){
  const callback=await forwardMainAuth(new Request(origin+'/auth/callback?code=synthetic-fixture-code'),{SUPABASE_URL:qa,MAIN_AUTH:{async fetch(request){
   assert.equal(request.url,MAIN_AUTH_ORIGIN+'/auth/callback?code=synthetic-fixture-code')
   return new Response(null,{status:302,headers:{Location:location,'Set-Cookie':'sb-qa-auth-token=fixture; Path=/; Secure'}})
  }}})
  assert.equal(callback.status,status)
  if(status===302)assert.equal(callback.headers.get('location'),origin+'/auth/reset-password')
 }
 const foreignCookie=await forwardMainAuth(req(),{SUPABASE_URL:qa,MAIN_AUTH:{async fetch(){return Response.json({success:true},{headers:{'Set-Cookie':'session=fixture; Domain=foreign.invalid; Path=/'}})}}})
 assert.equal(foreignCookie.status,502)
})

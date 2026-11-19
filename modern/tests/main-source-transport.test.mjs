import test from 'node:test'
import assert from 'node:assert/strict'
import {forwardMainSource,originalApiAllowed} from '../src/api/main-source.ts'
const candidate='https://uptilldawn-modern-main.uptilldawn.workers.dev',main='https://uptilldawn-main.uptilldawn.workers.dev',qa='https://npbjrtiolqperdgljnhi.supabase.co'
const req=(path='/api/migration/actions',headers={})=>new Request(candidate+path,{method:'POST',headers:{Origin:candidate,'Content-Type':'application/json',Cookie:'sb-qa-auth-token=synthetic',...headers},body:'{}'})
test('only committed API methods use fixed Main host and cookie authority, never caller authorization',async()=>{
 let calls=0
 const response=await forwardMainSource(req(undefined,{Host:'evil.invalid','X-Forwarded-Host':'evil.invalid',Authorization:'Bearer forged','X-Role':'admin'}),{SUPABASE_URL:qa,MAIN_AUTH:{async fetch(r){
  calls++;assert.equal(r.url,main+'/api/migration/actions');assert.equal(r.headers.get('host'),new URL(main).host);assert.equal(r.headers.get('origin'),main);assert.equal(r.headers.get('authorization'),null);assert.equal(r.headers.get('x-role'),null);assert.equal(r.headers.get('cookie'),'sb-qa-auth-token=synthetic');assert.equal(await r.text(),'{}')
  const headers=new Headers({'Content-Type':'application/json'});headers.append('Set-Cookie','a=synthetic; Path=/; HttpOnly');headers.append('Set-Cookie','b=synthetic; Path=/; HttpOnly');return Response.json({value:['value',true]},{headers})
 }}})
 assert.equal(response.status,200);assert.equal(calls,1);assert.equal(response.headers.getSetCookie().length,2)
 assert.match(response.headers.get('cache-control'),/no-store/)
 assert.equal(originalApiAllowed('/api/migration/actions','GET'),false)
 assert.equal(originalApiAllowed('/api/god/arbitrary-exec','POST'),false)
})
test('forged origins, unbound production and unknown operations stop before the Main service',async()=>{
 let calls=0
 const binding={async fetch(){calls++;throw Error('not permitted')}}
 for(const [request,env,status]of [
  [req(undefined,{Origin:'https://evil.invalid'}),{SUPABASE_URL:qa,MAIN_AUTH:binding},403],
  [req(undefined,{'Sec-Fetch-Site':'cross-site'}),{SUPABASE_URL:qa,MAIN_AUTH:binding},403],
  [req(),{SUPABASE_URL:'https://production.invalid',MAIN_AUTH:binding},503],
  [req(),{SUPABASE_URL:qa},503],
  [req('/api/unknown'),{SUPABASE_URL:qa,MAIN_AUTH:binding},404],
  [req(undefined,{'Content-Length':String(65*1024*1024)}),{SUPABASE_URL:qa,MAIN_AUTH:binding},413],
 ])assert.equal((await forwardMainSource(request,env)).status,status)
 assert.equal(calls,0)
})
test('download and SSE replies stream unchanged; only Main redirects return to candidate',async()=>{
 for(const [location,expected]of [[main+'/settings',candidate+'/settings'],['https://provider.invalid/consent','https://provider.invalid/consent']]){
  const response=await forwardMainSource(req(),{SUPABASE_URL:qa,MAIN_AUTH:{async fetch(){return new Response(null,{status:303,headers:{Location:location}})}}})
  assert.equal(response.headers.get('location'),expected)
 }
 const response=await forwardMainSource(req(),{SUPABASE_URL:qa,MAIN_AUTH:{async fetch(){return new Response('data: fixture\n\n',{headers:{'Content-Type':'text/event-stream'}})}}})
 assert.equal(await response.text(),'data: fixture\n\n')
 const denied=await forwardMainSource(req(),{SUPABASE_URL:qa,MAIN_AUTH:{async fetch(){return new Response(null,{headers:{'Set-Cookie':'a=synthetic; Domain=evil.invalid'}})}}})
 assert.equal(denied.status,502)
})

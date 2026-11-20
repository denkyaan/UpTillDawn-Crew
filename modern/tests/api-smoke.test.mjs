import test from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/api/worker.ts'

const origin='https://modern-candidate.invalid'
const request=(path,init,env)=>app.request(origin+path,init,env||{})

test('the Hono Worker exposes one unprivileged health check with no caching',async()=>{
 const response=await request('/api/v1/health')
 assert.equal(response.status,200)
 const body=await response.json()
 assert.deepEqual(body,{ok:true,service:'uptilldawn-local-first-api'})
 assert.match(response.headers.get('cache-control')||'',/no-store/)
 assert.equal(response.headers.get('x-content-type-options'),'nosniff')
})
test('native deployment readiness is public, version-specific and never calls private auth configuration',async()=>{
 const response=await request('/api/v1/health',undefined,{MAIN_AUTH_RUNTIME:{runtimeConfiguration(){throw Error('public readiness must not read private configuration')}}})
 assert.equal(response.status,200)
 assert.equal(response.headers.get('x-uptilldawn-auth-protocol'),'main-auth-native-v1')
 assert.deepEqual(await response.json(),{ok:true,service:'uptilldawn-local-first-api'})
 const legacy=await request('/api/v1/health')
 assert.equal(legacy.headers.get('x-uptilldawn-auth-protocol'),null)
})
test('anonymous or malformed bearer tokens never contact the database',async()=>{
 for(const authorization of [undefined,'Bearer xyz','Bearer x.y.z','Basic user:pass','Bearer '+'a'.repeat(9000)]){
  const headers=authorization?{Authorization:authorization}:{}
  const response=await request('/api/v1/session',{headers})
  assert.equal(response.status,401)
  assert.deepEqual(await response.json(),{error:'authentication_required'})
  assert.match(response.headers.get('cache-control')||'',/no-store/)
 }
})
test('a structurally valid bearer with no provider bindings fails closed with 503',async()=>{
 const token='a'.repeat(35)
 const response=await request('/api/v1/session',{headers:{Authorization:'Bearer '+token}})
 assert.equal(response.status,503)
 assert.deepEqual(await response.json(),{error:'service_unconfigured'})
})
test('unknown HTTP routes never return a false-positive SPA document',async()=>{
 for(const path of ['/api/v1/unknown','/api/v1/admin','/api/v1/payments','/api/anything']){
  const response=await request(path)
  assert.equal(response.status,404)
  assert.deepEqual(await response.json(),{error:'not_found'})
 }
 const response=await request('/api/v1/session',{method:'POST'})
 assert.equal(response.status,404)
})

test('OAuth endpoints are deny-by-default and never return secrets without a bearer token',async()=>{
 for(const route of ['/api/v1/integrations/oauth/start','/api/v1/integrations/oauth/complete']){
  const resp=await request(route,{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({provider:'sumup',code:'fake-code',state:'a'.repeat(64)})})
  assert.equal(resp.status,401)
  assert.deepEqual(await resp.json(),{error:'authentication_required'})
  assert.match(resp.headers.get('cache-control')||'',/no-store/)
 }
})

// Actual source Next HTTP vs generated native authentication source against
// the same disposable Supabase. Do not change the deployed runtime scope.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createServerClient,parseCookieHeader} from '@supabase/ssr'
import {executeOriginalAuth} from '../src/api/native-auth.generated.mjs'
import {NextRequest,NextResponse,withNativeAuth,cookies} from '../src/api/native-auth-context.ts'
import {isNativeAuthProject,nativeRuntimeScope} from '../src/api/runtime-scope.ts'
import {parseIdentity,isActive} from '../src/shared/identity.ts'
const dbUrl='http://127.0.0.1:54321',source='http://127.0.0.1:3000',native='http://127.0.0.1:4176'
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'',password=process.env.BOT_TEST_PASSWORD||''
assert.equal(process.env.BOT_SUPABASE_URL,dbUrl)
assert.equal(process.env.BOT_DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres')
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,dbUrl)
assert.equal(process.env.NEXT_PUBLIC_APP_URL,source)
assert.ok(key&&key!==process.env.BOT_SERVICE_ROLE_KEY&&password.length>=24)
assert.equal(isNativeAuthProject(native,dbUrl),false)
assert.equal(nativeRuntimeScope({SUPABASE_URL:dbUrl,UPT_MIGRATION_RUNTIME_TARGET:'main-standalone',UPT_MIGRATION_NATIVE_AUTH_ENABLED:'true'}),null)
const roles=[
 ['head-admin','bot-01-admin-nl','admin',false],['responsible','bot-02-responsible-fr','responsible',false],
 ['staff','bot-03-staff-en','staff',false],['administration','bot-04-staff-de','administration',false],
 ['promotion','bot-05-staff-nl','promotion',false],['left-hand','bot-06-staff-fr','administration',false],
 ['right-hand','bot-07-staff-en','administration',false],['maker','bot-16-maker','admin',true]
]
const fetchBefore=globalThis.fetch
globalThis.fetch=(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input))
 if(![source,dbUrl].includes(url.origin))throw Error('NONLOCAL_NETWORK_BLOCKED')
 return fetchBefore(input,{...init,redirect:'error',signal:init?.signal||AbortSignal.timeout(10000)})
}
const request=(origin,email,portal,requestOrigin=origin,site='same-origin')=>{
 const body=new FormData();body.set('email',email);body.set('password',password);body.set('portal',portal)
 return new Request(origin+'/api/auth/portal-login',{method:'POST',headers:{Origin:requestOrigin,'Sec-Fetch-Site':site},body})
}
async function nativeLogin(req){
 const env={NODE_ENV:'production',NEXT_PUBLIC_APP_URL:native,NEXT_PUBLIC_SUPABASE_URL:dbUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:key}
 return withNativeAuth(req,env,async()=>{
  const response=await executeOriginalAuth(new NextRequest(req))
  const headers=new Headers(response.headers)
  ;(await cookies()).appendTo(headers)
  if(response instanceof NextResponse)response.cookies.appendTo(headers)
  return new Response(response.body,{status:response.status,headers})
 })
}
async function verify(response,email,owner){
 const body=await response.json()
 if(response.status!==200||body.success!==true)throw Error('AUTH_RESULT_'+(typeof body.code==='string'&&/^[a-z_]+$/.test(body.code)?body.code:'denied'))
 const cookieLines=response.headers.getSetCookie()
 const jar=new Map(cookieLines.flatMap(line=>parseCookieHeader(line.split(';',1)[0]).map(c=>[c.name,c.value||''])))
 assert.ok([...jar.keys()].some(name=>/^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(name)))
 const db=createServerClient(dbUrl,key,{cookies:{getAll:()=>Array.from(jar,([name,value])=>({name,value})),setAll:changes=>{for(const c of changes)jar.set(c.name,c.value)}}})
 try{
  const {data:{user},error}=await db.auth.getUser()
  assert.ifError(error);assert.equal(user?.email,email)
  const ctx=await db.rpc('upt_current_session_context')
  assert.ifError(ctx.error)
  const identity=parseIdentity(ctx.data?.[0])
  assert.ok(identity&&identity.id===user.id&&isActive(identity))
  assert.equal(identity.is_owner,owner)
  const workspace=jar.get('uptilldawn-last-workspace')
  assert.ok(workspace?.startsWith(user.id+':'))
  return {redirect:body.redirectTo,role:identity.role,effectiveRole:identity.effective_role,owner:identity.is_owner,workspace:workspace.slice(user.id.length+1)}
 }finally{await db.auth.signOut({scope:'local'}).catch(()=>{})}
}
const report={validatedSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,scope:'local-original-next-vs-generated-native-auth',roles:[],denials:[],failures:[],deployedWorkerVerified:false}
try{
 for(const [role,name,portal,owner] of roles){
  try{
   const email=name+'@bots.uptilldawn.test'
   const a=await verify(await fetch(request(source,email,portal)),email,owner)
   const b=await verify(await nativeLogin(request(native,email,portal)),email,owner)
   assert.deepEqual(b,a)
   report.roles.push({role,outcome:'pass',owner,redirect:a.redirect})
   console.log('PASS local native authentication parity '+role)
  }catch(error){report.failures.push({role,reason:/^AUTH_RESULT_[a-z_]+$/.test(error.message)?error.message:error.name});console.error('FAIL local native authentication parity '+role+' '+report.failures.at(-1).reason)}
 }
 for(const [label,email,portal,foreign,site] of [
  ['cross-origin','bot-03-staff-en','staff',true,'cross-site'],
  ['same-origin-cross-site','bot-03-staff-en','staff',false,'cross-site'],
  ['staff-admin','bot-03-staff-en','admin',false,'same-origin']
 ]){
  try{
   const address=email+'@bots.uptilldawn.test'
   const [a,b]=await Promise.all([fetch(request(source,address,portal,foreign?'https://foreign.invalid':source,site)),nativeLogin(request(native,address,portal,foreign?'https://foreign.invalid':native,site))])
   const [x,y]=await Promise.all([a.json(),b.json()])
   assert.equal(a.status,b.status)
   assert.equal(x.code,y.code)
   assert.notEqual(x.success,true);assert.notEqual(y.success,true)
   assert.equal(x.code,site==='cross-site'?'invalid_origin':'wrong_portal')
   report.denials.push({label,outcome:'pass'})
  }catch(error){report.failures.push({label,reason:error.name})}
 }
}finally{
 globalThis.fetch=fetchBefore
 const dir=resolve(import.meta.dirname,'../../test-results/phase-two-three-local-native');mkdirSync(dir,{recursive:true})
 writeFileSync(resolve(dir,'native-auth-parity.json'),JSON.stringify(report,null,2)+'\n')
 if(report.failures.length||report.roles.length!==8||report.denials.length!==3)process.exitCode=1
}

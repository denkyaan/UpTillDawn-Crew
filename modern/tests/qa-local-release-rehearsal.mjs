// Isolated release evidence: real signed Hono session endpoint, database
// metadata-only preflight and local transaction rollback. Not Cloudflare
// runtime metrics, physical restore or Worker version rollback.
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {execFileSync} from 'node:child_process'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import app from '../src/api/worker.ts'
const root=resolve(import.meta.dirname,'../..'),dbUrl='http://127.0.0.1:54321',pg='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'',password=process.env.BOT_TEST_PASSWORD||''
assert.equal(process.env.BOT_SUPABASE_URL,dbUrl);assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,dbUrl);assert.equal(process.env.BOT_DB_URL,pg)
assert.ok(key&&key!==process.env.BOT_SERVICE_ROLE_KEY&&password.length>=24)
const dir=resolve(root,'test-results/phase-two-three-local-native');mkdirSync(dir,{recursive:true})
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
const report={validatedSha:sha,runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,scope:'disposable-loopback',checks:{},failures:[],liveCloudflarePerformanceVerified:false,physicalRestoreVerified:false,workerRollbackVersionVerified:false,productionReady:false}
const fetchBefore=globalThis.fetch
globalThis.fetch=(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input));if(url.origin!==dbUrl)throw Error('NONLOCAL_NETWORK_BLOCKED');return fetchBefore(input,{...init,redirect:'error'})}
const psql=statement=>execFileSync('psql',[pg,'-X','-v','ON_ERROR_STOP=1','-At','-F','|','-c',statement],{encoding:'utf8',timeout:30000}).trim()
async function check(name,fn){try{report.checks[name]=await fn();console.log('PASS local release '+name)}catch(error){report.failures.push({name,reason:String(error?.message||'FAILED').split('\n')[0].slice(0,120)});console.error('FAIL local release '+name+' '+report.failures.at(-1).reason)}}
try{
 await check('schemaPreflight',async()=>{
  const sql=readFileSync(resolve(root,'scripts/production-preflight-readonly.sql'),'utf8')
  const rows=psql('BEGIN READ ONLY;\n'+sql+'\nROLLBACK;').split('\n').filter(x=>x.includes('|')).map(x=>{const [name,required,passed,verdict]=x.split('|');return {name,required:required==='t',passed:passed==='t',verdict}})
  assert.equal(rows.filter(x=>x.required).length,24,'PREFLIGHT_REQUIRED_COUNT')
  assert.ok(rows.every(x=>!x.required||x.passed),'PREFLIGHT_REQUIRED_FAILED '+rows.filter(x=>x.required&&!x.passed).map(x=>x.name).join(','))
  return {required:24,passed:24,rows,productionVerified:false}
 })
 await check('transactionRollback',async()=>{
  const id='00000000-0000-4000-8000-00000000e2e1'
  const prior=psql("SELECT md5(to_jsonb(e)::text) FROM public.events e WHERE id='"+id+"'::uuid")
  assert.match(prior,/^[a-f0-9]{32}$/)
  const result=psql("BEGIN; UPDATE public.events SET name='PHASE23 rollback fixture' WHERE id='"+id+"'::uuid; SELECT name FROM public.events WHERE id='"+id+"'::uuid; ROLLBACK;")
  assert.ok(result.includes('PHASE23 rollback fixture'))
  assert.equal(psql("SELECT md5(to_jsonb(e)::text) FROM public.events e WHERE id='"+id+"'::uuid"),prior)
  return {changedInsideTransaction:true,originalRowHashRestored:true,physicalDatabaseRestore:false,workerRollback:false}
 })
 await check('thirtySignedHonoSessions',async()=>{
  const roles=['bot-01-admin-nl','bot-06-staff-fr','bot-07-staff-en','bot-02-responsible-fr','bot-03-staff-en','bot-04-staff-de','bot-05-staff-nl','bot-16-maker']
  const sessions=[],ids=new Set(),users=new Set(),stages=[]
  try{
   for(let i=0;i<30;i++){
    const db=createClient(dbUrl,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
    const email=roles[i%roles.length]+'@bots.uptilldawn.test'
    const {data,error}=await db.auth.signInWithPassword({email,password})
    if(error||!data.session||data.user?.email!==email)throw Error('SIGNED_LOAD_LOGIN_FAILED')
    sessions.push({db,id:data.user.id,token:data.session.access_token})
    const claim=JSON.parse(Buffer.from(data.session.access_token.split('.')[1],'base64url').toString())
    assert.equal(claim.sub,data.user.id);assert.ok(claim.session_id&&!ids.has(claim.session_id))
    ids.add(claim.session_id);users.add(data.user.id)
   }
   assert.equal(ids.size,30);assert.equal(users.size,8)
   const env={SUPABASE_URL:dbUrl,SUPABASE_ANON_KEY:key,UPT_MIGRATION_ALLOW_WRITES:'false'}
   for(const count of [6,12,30]){
    const outcomes=await Promise.allSettled(sessions.slice(0,count).map(async s=>{
     const start=performance.now()
     const response=await app.request('http://127.0.0.1:5174/api/v1/session',{headers:{Authorization:'Bearer '+s.token}},env)
     assert.equal(response.status,200,'SIGNED_LOAD_HTTP_'+response.status)
     const body=await response.json();assert.equal(body.id,s.id);assert.equal(typeof body.owner,'boolean')
     return Math.round(performance.now()-start)
    }))
    const failed=outcomes.filter(x=>x.status!=='fulfilled')
    assert.equal(failed.length,0,'SIGNED_LOAD_STAGE_FAILED '+count)
    const values=outcomes.map(x=>x.value).sort((a,b)=>a-b)
    const p95=values[Math.ceil(.95*values.length)-1]
    assert.ok(p95<=12500,'LOCAL_LOAD_LATENCY_BUDGET')
    stages.push({count,passed:count,p95Millis:p95,maxMillis:values.at(-1)})
   }
   const anonymous=await app.request('http://127.0.0.1:5174/api/v1/session',{},env)
   assert.equal(anonymous.status,401)
   return {distinctSessions:30,distinctAccounts:8,stages,anonymousDenied:true,cloudflareMeasured:false}
  }finally{for(const s of sessions)await s.db.auth.signOut({scope:'local'}).catch(()=>{})}
 })
}finally{
 globalThis.fetch=fetchBefore
 writeFileSync(resolve(dir,'release-rehearsal.json'),JSON.stringify(report,null,2)+'\n')
 if(report.failures.length)process.exitCode=1
}

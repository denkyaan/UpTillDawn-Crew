// Exhaustive source-derived transport test. Separate from real positive
// persistence tests: a rejected payload is never evidence of business parity.
// Run against all 16 native dispatch families. No provider or remote calls.
import assert from 'node:assert/strict'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createClient} from '@supabase/supabase-js'
import {encode} from '../../lib/migration/wire.ts'
import {nativeAdminActionIds,nativeAdminActionResponse} from '../src/api/native-admin-actions.ts'
import {nativeWaveTwoActionIds,nativeWaveTwoActionResponse} from '../src/api/native-platform-actions.ts'
import {nativeWaveThreeActionIds,nativeWaveThreeActionResponse} from '../src/api/native-event-shift-actions.ts'
import {nativeInventoryActionIds,nativeInventoryActionResponse} from '../src/api/native-inventory-checklist-actions.ts'
import {nativeRosterActionIds,nativeRosterActionResponse} from '../src/api/native-roster-handover-actions.ts'
import {nativeCatalogActionIds,nativeCatalogActionResponse} from '../src/api/native-catalog-event-actions.ts'
import {megaPeopleActionIds,megaPeopleResponse} from '../src/api/native-mega-people-actions.ts'
import {megaOperationsActionIds,megaOperationsResponse} from '../src/api/native-mega-operations-actions.ts'
import {megaCrewEventActionIds,megaCrewEventResponse} from '../src/api/native-mega-crew-event-actions.ts'
import {megaMakerActionIds,megaMakerResponse} from '../src/api/native-mega-maker-actions.ts'
import {nativeWaveNineActionIds,nativeWaveNineResponse} from '../src/api/native-wave-nine-safe-actions.ts'
import {finalCrewActionIds,finalCrewActionResponse} from '../src/api/native-final-crew-actions.ts'
import {finalOperationsActionIds,finalOperationsActionResponse} from '../src/api/native-final-operations-actions.ts'
import {finalAdminDetailsActionIds,finalAdminDetailsResponse} from '../src/api/native-final-admin-details.ts'
import {finalFinanceActionIds,finalFinanceResponse} from '../src/api/native-final-finance-actions.ts'
import {finalAgreementsActionIds,finalAgreementsResponse} from '../src/api/native-final-agreements-actions.ts'
const groups=[
 ['native-admin-actions',nativeAdminActionIds,nativeAdminActionResponse],
 ['native-platform-actions',nativeWaveTwoActionIds,nativeWaveTwoActionResponse],
 ['native-event-shift-actions',nativeWaveThreeActionIds,nativeWaveThreeActionResponse],
 ['native-inventory-checklist-actions',nativeInventoryActionIds,nativeInventoryActionResponse],
 ['native-roster-handover-actions',nativeRosterActionIds,nativeRosterActionResponse],
 ['native-catalog-event-actions',nativeCatalogActionIds,nativeCatalogActionResponse],
 ['native-mega-people-actions',megaPeopleActionIds,megaPeopleResponse],
 ['native-mega-operations-actions',megaOperationsActionIds,megaOperationsResponse],
 ['native-mega-crew-event-actions',megaCrewEventActionIds,megaCrewEventResponse],
 ['native-mega-maker-actions',megaMakerActionIds,megaMakerResponse],
 ['native-wave-nine-safe-actions',nativeWaveNineActionIds,nativeWaveNineResponse],
 ['native-final-crew-actions',finalCrewActionIds,finalCrewActionResponse],
 ['native-final-operations-actions',finalOperationsActionIds,finalOperationsActionResponse],
 ['native-final-admin-details',finalAdminDetailsActionIds,finalAdminDetailsResponse],
 ['native-final-finance-actions',finalFinanceActionIds,finalFinanceResponse],
 ['native-final-agreements-actions',finalAgreementsActionIds,finalAgreementsResponse]
]

const target='http://127.0.0.1:54321'
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||''
const password=process.env.BOT_TEST_PASSWORD||''
assert.equal(process.env.BOT_SUPABASE_URL,target)
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,target)
assert.equal(process.env.BOT_DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres')
assert.ok(key&&key!==process.env.BOT_SERVICE_ROLE_KEY&&password.length>=24)
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
const registry=readFileSync(new URL('../../lib/migration/original-action-registry.ts',import.meta.url),'utf8')
const ids=[...registry.matchAll(/^"([^"]+#\w+)":/gm)].map(x=>x[1])
const entries=groups.flatMap(([family,group,handler])=>group.map(id=>({family,id,handler})))
assert.equal(ids.length,163);assert.equal(new Set(ids).size,163)
assert.deepEqual(entries.map(x=>x.id).sort(),ids.toSorted())
const originalFetch=globalThis.fetch
let networkCalls=0
const localFetch=(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input))
 if(url.origin!==target)throw Error('NONLOCAL_NETWORK_BLOCKED')
 networkCalls++
 return originalFetch(input,{...init,redirect:'error'})
}
globalThis.fetch=localFetch
const roles=[
 ['head','bot-01-admin-nl'],['left-hand','bot-06-staff-fr'],['right-hand','bot-07-staff-en'],
 ['responsible','bot-02-responsible-fr'],['staff','bot-03-staff-en'],
 ['administration','bot-04-staff-de'],['promotion','bot-05-staff-nl'],['maker','bot-16-maker']
]
const origin='http://127.0.0.1:5174'
const scenarios=['cross-origin','forged-id','malformed-arguments']
const rows=[],failures=[],identities=[]
function req(id,scenario){
 const form=new FormData()
 form.set('_id',scenario==='forged-id'?'invalid#unregistered':id)
 form.set('_args',scenario==='malformed-arguments'?'{invalid':JSON.stringify(encode([new FormData()],form)))
 return new Request(origin+'/api/migration/actions',{method:'POST',headers:{
  Origin:scenario==='cross-origin'?'https://invalid.example':origin,
  'Sec-Fetch-Site':'same-origin','X-UpTillDawn-Action-Hint':id
 },body:form})
}
const expected=(id,s)=>id.endsWith('#godModeLogout')?403:s==='cross-origin'?403:s==='forged-id'?404:400
function record(e,role,scenario,outcome,reason){
 rows.push({id:e.id,family:e.family,role,scenario,outcome,...(reason?{reason}:{})})
 if(outcome!=='pass')failures.push({id:e.id,family:e.family,role,scenario,reason:reason||'UNKNOWN'})
}
try{
 for(const [role,bot] of roles){
  const db=createClient(target,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:localFetch}})
  const email=bot+'@bots.uptilldawn.test'
  try{
   const {data,error}=await db.auth.signInWithPassword({email,password})
   if(error||data.user?.email!==email)throw Error('SIGNED_IDENTITY_FAILED')
   const user=await db.auth.getUser()
   if(user.error||user.data.user?.id!==data.user.id)throw Error('SIGNED_IDENTITY_MISMATCH')
   identities.push(role)
   // Invalid transport must be rejected BEFORE a database call, even for
   // a real signed-in session. The proxy records attempted access as failure.
   let touched=0
   const guarded=new Proxy(db,{get(object,property){
    touched++
    throw Error('INVALID_TRANSPORT_TOUCHED_DATABASE')
   }})
   for(const e of entries)for(const scenario of scenarios){
    touched=0
    const before=networkCalls
    try{
     const res=await e.handler(req(e.id,scenario),guarded,e.id,()=>{throw Error('PROVIDER_CALL_FORBIDDEN')})
     assert.equal(res.status,expected(e.id,scenario),'HTTP_STATUS_'+res.status)
     assert.equal(touched,0,'DATABASE_ACCESSED')
     assert.equal(networkCalls,before,'NETWORK_ACCESSED')
     record(e,role,scenario,'pass')
    }catch(error){record(e,role,scenario,'fail',String(error?.message||'FAILED').split('\n')[0].slice(0,120))}
   }
  }catch{
   for(const e of entries)for(const scenario of scenarios)record(e,role,scenario,'blocked','SIGNED_IDENTITY_FAILED')
  }finally{try{await db.auth.signOut({scope:'local'})}catch{}}
 }
}finally{
 globalThis.fetch=originalFetch
 const dir=resolve(import.meta.dirname,'../../test-results/phase-two-three-local-native')
 mkdirSync(dir,{recursive:true})
 let positive=null
 try{positive=JSON.parse(readFileSync(resolve(dir,'report.json'),'utf8'))}catch{}
 const sameRevision=positive?.validatedSha===sha&&positive?.runId===process.env.GITHUB_RUN_ID&&positive?.runAttempt===process.env.GITHUB_RUN_ATTEMPT
 const proven=new Set(sameRevision?positive.positiveActionIds:[])
 const failedPositive=new Set(sameRevision?positive.operations.filter(x=>x.outcome==='failure').map(x=>x.id):[])
 const actions=entries.map(({id,family})=>({id,family,
  positivePersistence:proven.has(id)?'verified':failedPositive.has(id)?'failed':'not_verified',
  transport:rows.filter(x=>x.id===id).every(x=>x.outcome==='pass')&&rows.filter(x=>x.id===id).length===roles.length*scenarios.length?'pass':'fail'
 }))
 const report={validatedSha:sha,runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,
  actionCount:ids.length,families:groups.length,identities,expectedCases:ids.length*roles.length*scenarios.length,
  passed:rows.filter(x=>x.outcome==='pass').length,failed:failures.length,failures,rows,actions,
  positiveVerified:actions.filter(x=>x.positivePersistence==='verified').length,
  remainingPositive:actions.filter(x=>x.positivePersistence!=='verified').map(x=>x.id),
  allPositiveVerified:actions.every(x=>x.positivePersistence==='verified'),liveParityVerified:false,productionReady:false}
 writeFileSync(resolve(dir,'all-actions.json'),JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify({actions:report.actionCount,roles:identities.length,passed:report.passed,expected:report.expectedCases,failed:report.failed,positive:report.positiveVerified,remaining:report.remainingPositive.length,failures:report.failures.slice(0,20)}))
 if(failures.length||identities.length!==roles.length||rows.length!==report.expectedCases)process.exitCode=1
}

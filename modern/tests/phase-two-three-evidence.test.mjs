import test from 'node:test'
import assert from 'node:assert/strict'
import {combinedEvidence} from '../scripts/phase-two-three-evidence.mjs'
const ids=Array.from({length:163},(_,i)=>'source.ts#action'+i)
const env={QA_VALIDATED_SHA:'a'.repeat(40),GITHUB_RUN_ID:'42',GITHUB_RUN_ATTEMPT:'2',QA_CANDIDATE_RUNTIME:'true',QA_ORIGINAL_RUNTIME:'true'}
const binding={validatedSha:env.QA_VALIDATED_SHA,runId:'42',runAttempt:'2'}
const live={...binding,allReadOnlyStagesPassed:true,stages:['transport','login-visual','seven-roles','thirty-sessions','deep-routes','all-action-write-denials'].map(stage=>({stage,outcome:'success'}))}
const verified=ids.flatMap(id=>['head-admin','staff'].map(role=>({id,role})))
const denials={...binding,originalActions:163,signedIdentities:2,publicWriteDenials:326,businessWrites:0,failures:[],verified}
const fixture={...binding,positiveFixtureTransactionsVerified:true,transactions:'success',cleanup:'success',verifiedActionIds:ids.slice(0,7),uniquePositiveActionIds:7}
test('combine exact SHA/run/attempt and expose all missing positive action IDs, not a false release pass',()=>{
 const r=combinedEvidence(env,ids,live,denials,fixture)
 assert.equal(r.actions.length,163)
 assert.equal(r.actions.filter(x=>x.publicDenialBothRoles).length,163)
 assert.equal(r.positiveActionCount,7);assert.equal(r.remainingPositiveActionCount,156)
 assert.equal(r.checks.readOnlyLiveAcceptance,true)
 assert.equal(r.checks.candidateRuntimePostDeploy,true)
 assert.equal(r.checks.all163PositiveTransactions,false)
 assert.equal(r.mainCutoverAllowed,false);assert.equal(r.productionDeploymentAllowed,false)
})
test('stale, duplicate, missing, failed or malformed evidence cannot authorize either phase',()=>{
 for(const bad of [null,{...live,runAttempt:'1'},{...live,stages:live.stages.slice(1)},{...live,stages:live.stages.map((x,i)=>i===0?{...x,outcome:'failure'}:x)}]){
  const r=combinedEvidence(env,ids,bad,denials,fixture)
  assert.equal(r.checks.readOnlyLiveAcceptance,false);assert.equal(r.checks.originalRuntimePostDeploy,false)
 }
 for(const bad of [null,{...denials,runId:'41'},{...denials,verified:verified.slice(1)},{...denials,verified:[...verified.slice(1),verified[1]]},{...denials,businessWrites:1}]){
  assert.equal(combinedEvidence(env,ids,live,bad,fixture).checks.allPublicWriteDenials,false)
 }
 for(const bad of [null,{...fixture,cleanup:'failure'},{...fixture,verifiedActionIds:['unknown'],uniquePositiveActionIds:1},{...fixture,validatedSha:'b'.repeat(40)}]){
  assert.equal(combinedEvidence(env,ids,live,denials,bad).positiveActionCount,0)
 }
 assert.throws(()=>combinedEvidence(env,ids.slice(1),live,denials,fixture),/REGISTRY_DRIFT/)
 assert.equal(combinedEvidence({...env,QA_ORIGINAL_RUNTIME:''},ids,live,denials,fixture).checks.originalRuntimePostDeploy,false)
})
test('even full action coverage is not equivalent to provider, maker, offline or production authorization',()=>{
 const r=combinedEvidence(env,ids,live,denials,{...fixture,verifiedActionIds:ids,uniquePositiveActionIds:163})
 assert.equal(r.checks.all163PositiveTransactions,true)
 assert.equal(r.phase2Complete,false);assert.equal(r.phase3Complete,false)
 assert.ok(r.blockers.includes('providerOnboardingAndCallbacks'))
 assert.ok(r.blockers.includes('verifiedRollbackVersion'))
 assert.ok(r.blockers.includes('explicitProductionReleaseAuthorization'))
})

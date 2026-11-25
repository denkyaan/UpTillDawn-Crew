import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {liveVerdict} from '../modern/scripts/qa-live-verdict.mjs'
const keys=['QA_TRANSPORT_OUTCOME','QA_LOGIN_OUTCOME','QA_ROLES_OUTCOME','QA_SESSIONS_OUTCOME','QA_DEEP_OUTCOME','QA_ACTIONS_OUTCOME']
const fixtureKeys=['QA_FIXTURE_OUTCOME','QA_FIXTURE_CLEANUP_OUTCOME']
const good=Object.fromEntries([['QA_VALIDATED_SHA','a'.repeat(40)],...[...keys,...fixtureKeys].map(key=>[key,'success'])])
test('only a valid exact SHA and six successful live QA stages can pass selected read-only checks',()=>{
 const report=liveVerdict(good)
 assert.equal(report.allReadOnlyStagesPassed,true)
 assert.equal(report.allSelectedStagesPassed,true)
 assert.equal(report.positiveFixtureTransactionsVerified,true)
 for(const key of keys)for(const outcome of ['failure','cancelled','skipped','',undefined,'bogus']){
  const bad=liveVerdict({...good,[key]:outcome})
  assert.equal(bad.allReadOnlyStagesPassed,false,key+' '+outcome)
  assert.equal(bad.allSelectedStagesPassed,false)
 }
 for(const key of fixtureKeys)for(const outcome of ['failure','cancelled','skipped','',undefined,'bogus']){
  const bad=liveVerdict({...good,[key]:outcome})
  assert.equal(bad.allReadOnlyStagesPassed,true)
  assert.equal(bad.positiveFixtureTransactionsVerified,false)
  assert.equal(bad.allSelectedStagesPassed,false)
 }
 assert.equal(liveVerdict({...good,QA_VALIDATED_SHA:'wrong'}).allReadOnlyStagesPassed,false)
 assert.equal(report.mainCutoverAllowed,false)
 assert.equal(report.productionReady,false)
 assert.equal(report.providerParityVerified,false)
 assert.equal(report.offlineReplayVerified,false)
 assert.equal(report.makerPositiveFlowVerified,false)
 assert.equal(report.businessWriteParityVerified,false)
})
test('each live test stage remains sequential, transport-gated, timed and independently evidenced without hiding failures',()=>{
 const workflow=readFileSync('.github/workflows/deploy-main.yml','utf8')
 const section=workflow.split('  qa-modern-main-qa:')[1].split('  qa-native-admin-http:')[0]
 const stages=['qa_transport','qa_login','qa_roles','qa_sessions','qa_deep','qa_actions','qa_fixture']
 const offsets=stages.map(id=>section.indexOf('id: '+id))
 assert.ok(offsets.every(x=>x>=0))
 assert.deepEqual([...offsets].sort((a,b)=>a-b),offsets)
 for(let i=1;i<stages.length;i++){
  const stage=section.slice(offsets[i],offsets[i+1]??section.indexOf('      # One consolidated'))
  assert.ok(stage.includes("!cancelled() && steps.qa_transport.outcome == 'success'"))
  assert.match(stage,/timeout-minutes: \d+/)
 }
 assert.ok(!section.includes('continue-on-error: true'))
 assert.ok(!section.includes('|| true'))
 assert.ok(section.includes('id: qa_fixture_cleanup'))
 assert.ok(section.includes("steps.qa_fixture.outcome != 'skipped'"))
 assert.ok(section.includes('QA_FIXTURE_CLEANUP_OUTCOME:'))
 assert.ok(section.includes('QA_VALIDATED_SHA:'))
 assert.ok(section.includes('node modern/scripts/qa-live-verdict.mjs'))
 assert.ok(section.includes('name: modern-main-live-verdict'))
 const fast=readFileSync('.github/workflows/fast-change-validation.yml','utf8')
 assert.ok(!fast.includes('qa-live-verdict.mjs'))
 assert.ok(!fast.includes('npm --prefix modern run sessions:qa'))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {evaluateReleaseEvidence} from '../lib/god-mode-resolution-evidence.ts'

const SHA_A='a'.repeat(40)
const SHA_B='b'.repeat(40)
const report={id:'00000000-0000-4000-8000-00000000e2e1',status:'failed',created_at:'2026-11-12T10:00:00.000Z'}
const run=(sha=SHA_A,env='main',updated='2026-11-12T10:30:00.000Z')=>({
 id:12345,head_sha:sha,status:'completed',conclusion:'success',
 event:env==='main'?'workflow_run':'workflow_dispatch',
 created_at:'2026-11-12T10:20:00.000Z',updated_at:updated,
})
function check(args={}){return evaluateReleaseEvidence({environment:'main',sha:SHA_A,report,runs:[run()],...args})}

test('God Mode: only the confirmed latest Main deployment can close an incident',()=>{
 assert.deepEqual(check(),{ok:true,runId:12345,sha:SHA_A,environment:'main'})
 assert.deepEqual(check({runs:[run(SHA_B),run(SHA_A,'main','2026-11-12T10:25:00.000Z')]}).ok,false)
 assert.equal(check({sha:SHA_B}).ok,false)
 assert.equal(check({runs:[]}).ok,false)
})

test('God Mode: a deployment that pre-dates the error is NOT repair evidence',()=>{
 assert.equal(check({runs:[run(SHA_A,'main','2026-11-12T09:58:00.000Z')]}).ok,false)
 assert.equal(check({runs:[run(SHA_A,'main','invalid time')]}).ok,false)
 assert.equal(check({report:{...report,created_at:'not a date'}}).ok,false)
})

test('God Mode: a pending or failed deploy cannot be presented as a repair',()=>{
 for(const status of ['in_progress','queued','completed']){
  const item={...run(),status,conclusion:status==='completed'?'failure':null}
  assert.equal(check({runs:[item]}).ok,false)
 }
 assert.equal(check({runs:[{...run(),event:'workflow_dispatch'}]}).ok,false,'Manual Main run is not a deployed workflow_run')
})

test('God Mode: reject invalid SHAs and already resolved reports',()=>{
 for(const sha of ['bad','A'.repeat(39),'abc'.repeat(20),'z'.repeat(40),''])
  assert.equal(check({sha}).ok,false)
 for(const status of ['resolved','auto_resolved'])
  assert.equal(check({report:{...report,status}}).ok,false)
})

test('God Mode: production requires independently confirmed live tag and production deploy',()=>{
 const candidate={environment:'production',sha:SHA_B,report,runs:[run(SHA_B,'production')],productionCurrentSha:SHA_B}
 assert.deepEqual(evaluateReleaseEvidence(candidate),{ok:true,runId:12345,sha:SHA_B,environment:'production'})
 for(const override of [
  {productionCurrentSha:SHA_A},
  {productionCurrentSha:null},
  {runs:[run(SHA_B,'main')]},
  {runs:[run(SHA_B,'production','2026-11-11T10:30:00.000Z')]},
 ]){
  assert.equal(evaluateReleaseEvidence({...candidate,...override}).ok,false)
 }
})

test('God Mode: resolving a report requires a real manually entered retest and verified release',()=>{
 const api=readFileSync('app/api/god/error-reports/route.ts','utf8')
 const ui=readFileSync('components/god-mode/god-studio.tsx','utf8')
 assert.match(api,/evaluateReleaseEvidence\(\{/)
 assert.match(api,/upt_god_error_reports/)
 assert.match(api,/body\.note\+' \| '\+environment\+' deployment verified:/)
 assert.match(api,/min\(30\)\.max\(4000\)/)
 assert.match(api,/sha:z\.string\(\)\.regex/)
 assert.match(ui,/Reproductie- en herstelbewijs/)
 assert.match(ui,/Gedeployde commit-SHA/)
 assert.match(ui,/HERSTEL CONTROLEREN/)
 assert.match(ui,/BEVESTIG GECONTROLEERD HERSTEL/)
 assert.doesNotMatch(ui,/Maker heeft de gemelde fout na controle als opgelost gemarkeerd/)
 assert.doesNotMatch(ui,/OPGELOST MARKEREN/)
})

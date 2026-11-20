import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'

test('one bundled release contract accounts for ALL seven migration domains without fabricated completion',()=>{
 const result=spawnSync(process.execPath,['modern/scripts/seven-bundle-readiness.mjs'],{encoding:'utf8',timeout:20000})
 assert.equal(result.status,0,result.stderr)
 const report=JSON.parse(result.stdout.trim())
 assert.equal(report.contract,'uptilldawn-main-seven-bundle-v1')
 assert.deepEqual(report.workstreams.map(x=>x.id),
  ['ui','actions','authorization','integrations','offline','e2e','cutover'])
 assert.equal(report.originalMainPreserved,true)
 assert.equal(report.productionUntouched,true)
 assert.equal(report.isolatedCandidateWriteEnabled,false)
 assert.equal(report.releaseReady,false)
 assert.equal(report.mainCutoverAllowed,false)
 assert.ok(report.workstreams.every(x=>x.verified===false&&x.blocker))
 const ui=report.workstreams.find(x=>x.id==='ui').available
 const actions=report.workstreams.find(x=>x.id==='actions').available
 const e2e=report.workstreams.find(x=>x.id==='e2e').available
 assert.equal(ui.originalPages,101)
 assert.equal(e2e.originalApis,64)
 assert.ok(actions.transportMapped>=163)
 assert.equal(report.exactActionRegistryMapped,true)
 assert.deepEqual(JSON.parse(readFileSync('test-results/modern-seven-bundle/readiness.json','utf8')),report)
})
test('attempting to cut over all seven domains before real acceptance must fail CLOSED',()=>{
 const gate=spawnSync(process.execPath,
  ['modern/scripts/seven-bundle-readiness.mjs','--enforce-cutover'],
  {encoding:'utf8',timeout:20000})
 assert.equal(gate.status,1,'Must never silently switch existing Main Worker')
 assert.match(gate.stderr,/ONE_BUNDLE_CUTOVER_BLOCKED/)
 for(const id of ['ui','actions','authorization','integrations','offline','e2e','cutover'])
  assert.ok(gate.stderr.includes('"'+id+'"'))
})

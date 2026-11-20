import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
const read=p=>readFileSync(p,'utf8')
test('original native auth verifies real source guards, cookie isolation and all five portal branches',()=>{
 const env={...process.env};delete env.NODE_TEST_CONTEXT
 const log=execFileSync(process.execPath,['--test','modern/tests/native-auth.test.mjs'],{encoding:'utf8',env})
 assert.match(log,/fail 0/)
})
test('only Main exposes the private auth entrypoint and retains the original default page handler',()=>{
 const main=JSON.parse(read('wrangler.main.jsonc')),production=JSON.parse(read('wrangler.jsonc'))
 assert.equal(main.main,'workers/main-entry.mjs');assert.equal(production.main,'.open-next/worker.js')
 const worker=read('workers/main-entry.mjs')
 assert.match(worker,/extends WorkerEntrypoint/);assert.match(worker,/return legacy.fetch\(request,env,ctx\)/)
 assert.match(worker,/mainAuthRuntimeConfiguration\(this.env\)/)
 const cfg=JSON.parse(read('modern/wrangler.main-qa.jsonc'))
 assert.ok(cfg.services.some(x=>x.service==='uptilldawn-main'&&x.binding==='MAIN_AUTH_RUNTIME'&&x.entrypoint==='MainAuthRuntime'))
 const workflow=read('.github/workflows/deploy-main.yml')
 const section=workflow.split('  deploy-modern-main-qa:')[1].split('  qa-modern-main-qa:')[0]
 assert.match(section,/needs: \[validate-trigger, deploy\]/)
 assert.ok(workflow.includes('MAIN_DIAGNOSTIC_TARGET: modern-main'))
})

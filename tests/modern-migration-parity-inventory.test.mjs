import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(path,'utf8')

test('every existing page, API route and server action is inventoried before cutover',()=>{
 const script=read('modern/scripts/inventory.mjs')
 assert.ok(script.includes('const pages=files.filter'))
 assert.ok(script.includes('const api=files.filter'))
 assert.ok(script.includes('const libActions='))
 assert.ok(script.includes('export\\s+async'))
 assert.ok(script.includes('const routes=['))
 assert.ok(script.includes('serverActionExports:serverActions'))
 assert.ok(script.includes('routes.length'))
 assert.ok(script.includes('criticalRoutesPending:criticalRoutes.length'))
 assert.ok(script.includes('migrationReady:false'))
 assert.ok(script.includes('productionCutoverAllowed:false'))
})
test('source reuse is not accepted as verified feature parity',()=>{
 const script=read('modern/scripts/inventory.mjs')
 assert.ok(script.includes('source-reused-acceptance-pending'))
 assert.ok(script.includes('verifiedPages:0'))
 assert.ok(script.includes('verifiedApis:0'))
 assert.ok(script.includes('verifiedServerActions:0'))
 assert.ok(script.includes('--enforce-parity'))
 assert.ok(script.includes('process.exitCode=1'))
})
test('migration-only build runs read-only inventory without altering 5 approved workflows or Main',()=>{
 const ci=read('.github/workflows/fast-change-validation.yml')
 const pkg=JSON.parse(read('modern/package.json'))
 assert.equal(pkg.scripts.inventory,'node scripts/inventory.mjs')
 assert.ok(ci.includes('npm --prefix modern run inventory'))
 assert.ok(ci.includes("github.event_name == 'pull_request' && startsWith(github.head_ref, 'migration/')"))
 assert.ok(!ci.includes('wrangler deploy'))
})

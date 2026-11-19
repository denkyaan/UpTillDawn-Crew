import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(path,'utf8')

test('Vite SPA and Hono Worker are both compiled before candidate promotion',()=>{
 const pkg=JSON.parse(read('modern/package.json'))
 const workflow=read('.github/workflows/fast-change-validation.yml')
 assert.equal(pkg.scripts['worker:check'],'wrangler deploy --dry-run --outdir .wrangler-candidate-dry-run')
 assert.ok(workflow.includes('npm --prefix modern run build'))
 assert.ok(workflow.includes('npm --prefix modern run budget'))
 assert.ok(workflow.includes('npm --prefix modern run worker:check'))
 assert.ok(workflow.includes('npm --prefix modern audit --omit=dev --audit-level=high'))
 const conditional="github.event_name == 'pull_request' && startsWith(github.head_ref, 'migration/')"
 assert.ok(workflow.includes(conditional))
 assert.ok(!workflow.includes('wrangler deploy'))
 assert.ok(!workflow.includes('uptilldawn-modern-candidate'))
})

test('Worker remains API-only, fail-closed, no service-role credentials or SSR',()=>{
 const worker=read('modern/src/api/worker.ts')
 const wrangler=JSON.parse(read('modern/wrangler.jsonc'))
 assert.deepEqual(wrangler.assets.run_worker_first,['/api/*','/auth/callback'])
 assert.equal(wrangler.assets.not_found_handling,'single-page-application')
 assert.ok(worker.includes('app.notFound('))
 assert.ok(worker.includes('app.onError('))
 assert.ok(worker.includes('app.use("/api/*"'))
 assert.ok(worker.includes('Cache-Control","private, no-store'))
 assert.ok(worker.includes('auth.getClaims(match[1])'))
 assert.ok(worker.includes('rpc("upt_current_session_context")'))
 assert.ok(!worker.includes('SERVICE_ROLE'))
})

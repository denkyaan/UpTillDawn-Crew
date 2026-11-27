import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const read=path=>readFileSync(path,"utf8")
test("production-shaped build is isolated, dry-run only, and does not rebuild Main for browser smoke",()=>{
 const ci=read(".github/workflows/fast-change-validation.yml")
 const script=read("modern/scripts/production-build-rehearsal.mjs")
 assert.ok(ci.includes("npm --prefix modern run worker:production-rehearsal"))
 // The phase-1 invariant applies to ordinary fast CI, not to the distinct
 // authenticated local browser comparison job introduced in phases 2/3.
 const fast=ci.split('\n  fast:\n')[1]?.split('\n  phase-two-three-local-acceptance:\n')[0]
 const isolated=ci.split('\n  phase-two-three-local-acceptance:\n')[1]?.split('\n  release-production:\n')[0]
 assert.ok(fast&&isolated,'CI job boundaries must remain explicit')
 assert.equal((fast.match(/npm --prefix modern run build\n/g)||[]).length,1)
 assert.doesNotMatch(fast,/npm run build:next/)
 assert.equal((isolated.match(/npm --prefix modern run build\n/g)||[]).length,1)
 assert.equal((isolated.match(/npm run build:next\n/g)||[]).length,1)
 assert.match(isolated,/github.event_name == 'pull_request' && startsWith\(github.head_ref, 'migration\/phase-2-3-'\)/)
 assert.match(isolated,/test "\$BOT_SUPABASE_URL" = "http:\/\/127\.0\.0\.1:54321"/)
 assert.doesNotMatch(isolated,/wrangler deploy|release_production/)
 assert.ok(script.includes('["deploy","--dry-run","--config",config'))
 assert.ok(script.includes('["build","--outDir",out]'))
 assert.ok(script.includes("hasQaKey"))
 assert.ok(script.includes("productionReady:false,deployed:false"))
 assert.ok(script.includes("rmSync(out,{recursive:true,force:true})"))
 assert.ok(read("modern/tests/browser-smoke.mjs").includes('route.abort("blockedbyclient")'))
 assert.equal(JSON.parse(read("modern/package.json")).scripts["worker:production-rehearsal"],"node scripts/production-build-rehearsal.mjs")
})

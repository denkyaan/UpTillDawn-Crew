import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const read=path=>readFileSync(path,"utf8")
test("production-shaped build is isolated, dry-run only, and does not rebuild Main for browser smoke",()=>{
 const ci=read(".github/workflows/fast-change-validation.yml")
 const script=read("modern/scripts/production-build-rehearsal.mjs")
 assert.ok(ci.includes("npm --prefix modern run worker:production-rehearsal"))
 assert.equal((ci.match(/npm --prefix modern run build\n/g)||[]).length,1)
 assert.ok(script.includes('["deploy","--dry-run","--config",config'))
 assert.ok(script.includes('["build","--outDir",out]'))
 assert.ok(script.includes("hasQaKey"))
 assert.ok(script.includes("productionReady:false,deployed:false"))
 assert.ok(script.includes("rmSync(out,{recursive:true,force:true})"))
 assert.ok(read("modern/tests/browser-smoke.mjs").includes('route.abort("blockedbyclient")'))
 assert.equal(JSON.parse(read("modern/package.json")).scripts["worker:production-rehearsal"],"node scripts/production-build-rehearsal.mjs")
})

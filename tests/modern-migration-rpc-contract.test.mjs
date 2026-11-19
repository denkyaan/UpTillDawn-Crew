import test from "node:test"
import assert from "node:assert/strict"
import {execFileSync} from "node:child_process"
import {readFileSync} from "node:fs"
const file=p=>readFileSync(p,"utf8")
const metadata=JSON.parse(file("modern/scripts/rpc-reference.json"))
test("all candidate RPCs are review-allowlisted without live credentials",()=>{
 assert.equal(metadata.requiredPublicRpcNames.length,36)
 const out=JSON.parse(execFileSync(process.execPath,["modern/scripts/rpc-contract.mjs"],{encoding:"utf8"}))
 assert.equal(out.sourceRpcCount,36)
 assert.deepEqual(out.unreviewedRpc,[])
 assert.deepEqual(out.noLongerReferenced,[])
 assert.equal(out.liveDatabaseVerifiedInCi,false)
 assert.equal(out.productionCutoverAllowed,false)
})
test("Production-missing session contract is recorded and cannot be silently released",()=>{
 assert.deepEqual(metadata.lastObserved.production.missing,["upt_current_session_context"])
 assert.deepEqual(metadata.lastObserved.mainQa.missing,[])
 const script=file("modern/scripts/rpc-contract.mjs")
 assert.ok(script.includes('if(process.argv.includes("--release"))'))
 assert.throws(()=>execFileSync(process.execPath,["modern/scripts/rpc-contract.mjs","--release"],{stdio:"pipe"}))
})
test("RPC audit checks stay candidate-only and do not expand the workflow inventory",()=>{
 const ci=file(".github/workflows/fast-change-validation.yml")
 assert.ok(ci.includes("npm --prefix modern run rpc:contract"))
 assert.ok(ci.includes("github.event_name == 'pull_request' && startsWith(github.head_ref, 'migration/')"))
 assert.ok(!file("modern/scripts/rpc-contract.mjs").includes("fetch("))
 assert.ok(!file("modern/scripts/rpc-contract.mjs").includes("service_role"))
})

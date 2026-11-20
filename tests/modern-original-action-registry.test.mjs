import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {actionEntries} from "../modern/tooling/main-source.mjs"
import {verifyOriginalActionRegistry} from "../modern/tooling/action-registry-contract.mjs"

test("all original client-dispatched server actions map to an exact static Main server handler",()=>{
 const entries=actionEntries()
 const registry=readFileSync("lib/migration/original-action-registry.ts","utf8")
 const verdict=verifyOriginalActionRegistry(entries,registry)
 assert.ok(verdict.sourceCount>=150,"Original business workflows unexpectedly dropped")
 assert.equal(verdict.sourceCount,verdict.registeredCount)
 // This is a server-side explicit allowlist, not user-controlled module loading.
 assert.ok(registry.includes('import "server-only"'))
 assert.ok(registry.includes("Readonly<Record<string,()=>Promise<OriginalAction>>>"))
})
test("missing, obsolete or duplicate original actions fail closed",()=>{
 const a="lib/actions/uptilldawn.ts#createEvent"
 const b="lib/actions/events.ts#closeEvent"
 const entry=id=>'"'+id+'":()=>import("./fixture").then(m=>m.x),'
 assert.equal(verifyOriginalActionRegistry([a,b],entry(a)+"\n"+entry(b)).registeredCount,2)
 assert.throws(()=>verifyOriginalActionRegistry([a,b],entry(a)),/missing/)
 assert.throws(()=>verifyOriginalActionRegistry([a],entry(a)+"\n"+entry(b)),/obsolete/)
 assert.throws(()=>verifyOriginalActionRegistry([a,a],entry(a)),/Duplicate/)
 assert.throws(()=>verifyOriginalActionRegistry([a],entry(a)+"\n"+entry(a)),/Duplicate/)
 assert.throws(()=>verifyOriginalActionRegistry([],""),/discovery unavailable/)
})
test("the migration inventory never fabricates action parity or hardcodes stale coverage",()=>{
 const inventory=readFileSync("modern/scripts/inventory.mjs","utf8")
 assert.ok(inventory.includes("verifyOriginalActionRegistry(sourceActionIds,registrySource)"))
 assert.ok(inventory.includes("originalActionsDispatched:originalActions.registeredCount"))
 assert.ok(!inventory.includes("originalActionsDispatched:163"))
 assert.ok(inventory.includes("migrationReady:false"))
 assert.ok(inventory.includes("productionCutoverAllowed:false"))
 assert.ok(inventory.includes("verifiedServerActions:0"))
 assert.ok(inventory.includes("Cutover blocked:"))
})

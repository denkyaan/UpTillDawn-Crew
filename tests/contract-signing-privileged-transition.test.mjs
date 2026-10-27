import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-signing-privileged-transition.ts",import.meta.url),"utf8")
test("signing transition checks authorization and verified evidence",()=>{
 assert.match(source,/import "server-only"/)
 assert.match(source,/await authorizedContractStorage\(\)/)
 assert.match(source,/remoteEvidenceVerified!==true/)
})
test("application runtime refuses privileged transitions until isolated worker exists",()=>{
 assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY/)
 assert.match(source,/throw new Error\("Signing transitions require an isolated privileged worker"\)/)
})

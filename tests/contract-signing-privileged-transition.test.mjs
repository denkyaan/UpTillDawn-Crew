import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-signing-privileged-transition.ts",import.meta.url),"utf8")
test("privileged signing transition stays server-only and checks operator access",()=>{
 assert.match(source,/import "server-only"/)
 assert.match(source,/await authorizedContractStorage\(\)/)
 assert.match(source,/remoteEvidenceVerified!==true/)
})
test("service-role secret is server environment only and session persistence is disabled",()=>{
 assert.match(source,/process\.env\.SUPABASE_SERVICE_ROLE_KEY/)
 assert.doesNotMatch(source,/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/)
 assert.match(source,/persistSession:false/)
 assert.match(source,/autoRefreshToken:false/)
})
test("signing mutation uses the scoped transition RPC",()=>{
 assert.match(source,/upt_server_transition_contract_signing/)
 assert.match(source,/if\(error\)throw/)
})

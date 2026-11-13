import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {validAccountAccess} from "../lib/administration/provider-account-access.ts"
import {parseIntegrationConfiguration} from "../lib/administration/integration-credentials.ts"

const src=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8")
const id="123e4567-e89b-42d3-a456-426614174000"

test("Ponto authorizations distinguish valid linked accounts, no consent and malformed responses without leaking identity",()=>{
 assert.equal(validAccountAccess({data:[{id,type:"account",attributes:{iban:"BE12345678901234",balance:100}}]}),"connected")
 assert.equal(validAccountAccess({data:[]}),"needs_account_access")
 for(const payload of [null,undefined,{},[],{data:null},{data:[null]},{data:[{}]},{data:[{type:"account",id:"../secret"}]},{data:[{type:"payment",id}]}])
  assert.equal(validAccountAccess(payload),"unavailable")
})

test("Billit sandbox settings enforce a numeric PartyID and reject unexpected providers",()=>{
 const party={BILLIT_SANDBOX_PARTY_ID:"123456",BILLIT_SANDBOX_API_KEY:"sandbox-example-token"}
 assert.deepEqual(parseIntegrationConfiguration("peppol",party),party)
 for(const value of ["not-numeric","123456\n","000000","12-34","123456<script>"]){
  assert.equal(parseIntegrationConfiguration("peppol",{...party,BILLIT_SANDBOX_PARTY_ID:value}),null,value)
 }
 assert.equal(parseIntegrationConfiguration("peppol",{...party,UNKNOWN:"secret"}),null)
})

test("Provider diagnostics use only documented read-only API calls, avoid secrets and money mutations",()=>{
 const server=src("lib/administration/provider-connection-check.ts")
 const route=src("app/api/admin/provider-connection-check/route.ts")
 const ui=src("components/admin/provider-connection-probe.tsx")
 const manager=src("components/admin/integration-credential-manager.tsx")
 const panel=src("components/admin/external-services-readiness.tsx")
 assert.match(server,/https:\/\/api\.sandbox\.billit\.be\/v1\/orders/)
 assert.match(server,/headers:\{"ApiKey":key!,"PartyID":party!/ )
 assert.match(server,/https:\/\/api\.myponto\.com\/accounts\?page%5Blimit%5D=1/)
 assert.match(server,/safeMetadata\(accounts\)/)
 assert.match(server,/validAccountAccess\(await safeMetadata\(accounts\)\)/)
 assert.match(server,/method:"GET"/)
 assert.match(server,/AbortSignal\.timeout\(6500\)/)
 assert.match(server,/size>16384/)
 assert.doesNotMatch(server,/\/payments|\/transactions|\/envelope\/distribute|\/orders\/commands\/send|method:"PUT"|method:"DELETE"/)
 assert.match(route,/integrationManagementAccess\(\)/)
 assert.match(route,/requestHasSameOrigin\(request\)/)
 assert.match(route,/getManagedIntegrationConfig\(access\.db,value as ConnectionProvider\)/)
 assert.match(route,/scope:value==="banking"\?"bank_accounts_read_only":"credentials_only"/)
 assert.match(route,/value!=="peppol"/)
 assert.match(panel,/service\.id==="peppol"/)
 assert.match(manager,/provider==="peppol"/)
 assert.match(ui,/needs_account_access/)
 assert.doesNotMatch(route,/access_token:|api_key:|secret:|partyId:/)
})

test("Only the owning Ticketing module renders Eventix integration status, never twice",()=>{
 const source=src("app/(app)/portals/administration/modules/[slug]/page.tsx")
 assert.doesNotMatch(source,/EventixIntegration/)
 assert.match(source,/integrationServicesForWorkspace\(slug,externalServicesReadiness\(process\.env\)\)/)
 assert.match(source,/ProviderMappingManager/)
 assert.match(source,/TicketSalesOverview/)
})

import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {integrationPlacement,integrationServicesForWorkspace} from "../lib/administration/integration-placement.ts"
import {externalServicesReadiness} from "../lib/administration/external-services-readiness.ts"
import {integrationProviders} from "../lib/administration/integration-credentials.ts"

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8")

test("each provider has one business-owned setup location; no duplicate global management directory",()=>{
 const expected={
  contracts:["documenso"],invoices:["peppol"],banking:["banking"],
  ticketing:["weeztix","eventix"],sales:["sumup","eventpay"],documents:["cloudmersive"],
 }
 assert.deepEqual(integrationPlacement,expected)
 const providers=Object.values(integrationPlacement).flat()
 assert.equal(new Set(providers).size,providers.length,"each service must have exactly one owning workspace")
 assert.deepEqual(providers.toSorted(),externalServicesReadiness({}).map(s=>s.id).toSorted())
 const all=externalServicesReadiness({})
 for(const [page,ids] of Object.entries(expected))
  assert.deepEqual(integrationServicesForWorkspace(page,all).map(s=>s.id),ids)
 assert.deepEqual(integrationServicesForWorkspace("settings",all),[])
 assert.deepEqual(integrationServicesForWorkspace("platform",all),[])
})

test("Admin and Administration reuse the same provider storage at domain-correct workflow pages",()=>{
 const admin=read("lib/admin-administration-navigation.ts")
 const modules=read("app/(app)/portals/administration/modules/[slug]/page.tsx")
 const sales=read("app/(app)/sales/page.tsx")
 const platform=read("app/(app)/admin/platform/page.tsx")
 const settings=read("app/(app)/portals/administration/modules/settings/page.tsx")
 for(const slug of ["contracts","invoices","banking","ticketing","documents"])
  assert.match(admin,new RegExp('slug:"'+slug+'"'))
 assert.match(modules,/integrationServicesForWorkspace\(slug,externalServicesReadiness\(process\.env\)\)/)
 assert.match(sales,/integrationServicesForWorkspace\('sales',externalServicesReadiness\(process\.env\)\)/)
 assert.match(sales,/integrationAccess\.ok&&<ExternalServicesReadiness/)
 assert.doesNotMatch(platform,/ExternalServicesReadiness|externalServicesReadiness/)
 assert.doesNotMatch(modules,/slug==="settings"&&<ExternalServicesReadiness/)
 assert.match(settings,/BillingProfile/)
})

test("credential management is provider-locked on each page while status-only providers stay read-only",()=>{
 const panel=read("components/admin/external-services-readiness.tsx")
 const manager=read("components/admin/integration-credential-manager.tsx")
 const route=read("app/api/administration/integrations/route.ts")
 assert.match(panel,/access\.ok&&managed\(service\.id\)/)
 assert.match(panel,/IntegrationCredentialManager initialLocale=\{locale\} provider=\{service\.id\}/)
 assert.match(panel,/ProviderConnectionProbe provider=\{service\.id\}/)
 assert.match(panel,/t\.instructions\[service\.id\]/)
 assert.match(panel,/t\.states\.credentials_present/)
 assert.match(manager,/provider:IntegrationProvider/)
 assert.doesNotMatch(manager,/<select[^>]*value=\{provider\}/)
 assert.deepEqual(integrationProviders,["sumup","documenso","banking","weeztix","peppol"])
 assert.ok(!integrationProviders.includes("eventpay"),"no simulated cashless checkout key")
 assert.ok(!integrationProviders.includes("eventix"),"read-only event import guidance until API integration is verified")
 assert.ok(!integrationProviders.includes("cloudmersive"),"optional OCR remains local-first")
 assert.match(route,/integrationManagementAccess\(\)/)
 assert.match(route,/saveIntegrationCredentials/)
 assert.match(route,/requestHasSameOrigin\(request\)/)
})

test("Weeztix event choice and OAuth callback return to Ticketing without unsafe origin inference",()=>{
 const manager=read("components/admin/integration-credential-manager.tsx")
 const callback=read("app/api/administration/integrations/weeztix/callback/route.ts")
 const api=read("app/api/administration/integrations/route.ts")
 const oauth=read("lib/administration/weeztix-oauth.ts")
 assert.match(manager,/events\.map\(item=><option/)
 assert.match(manager,/WEEZTIX_ACTIVE_EVENT_ID/)
 assert.match(manager,/state\?\.weeztixOauthCallbackUrl/)
 assert.match(callback,/const SETTINGS="\/portals\/administration\/modules\/ticketing"/)
 assert.match(callback,/sameState\(/)
 assert.match(api,/weeztixCallbackUrl\(request\)/)
 assert.match(oauth,/UPT_WEEZTIX_OAUTH_ORIGIN/)
 assert.match(oauth,/url\.protocol==="https:"/)
 assert.match(oauth,/url\.host\.toLowerCase\(\)===host/)
 assert.doesNotMatch(manager,/https:\/\/uptilldawn-main\.uptilldawn\.workers\.dev\/api\/administration\/integrations\/weeztix\/callback/)
})

test("No credentials create live EventPay, Peppol, banking, or contract delivery claims",()=>{
 const panel=read("components/admin/external-services-readiness.tsx")
 const readiness=read("lib/administration/external-services-readiness.ts")
 const api=read("app/api/admin/provider-connection-check/route.ts")
 assert.match(panel,/t\.states\.credentials_present/)
 assert.match(readiness,/provider_required/)
 assert.match(readiness,/manual_available/)
 assert.match(api,/scope:value==="banking"\?"bank_accounts_read_only":"credentials_only"/)
 assert.doesNotMatch(panel,/paymentSucceeded|liveEnabled|transactionConfirmed/)
})

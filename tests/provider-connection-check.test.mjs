import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {externalServicesReadiness} from "../lib/administration/external-services-readiness.ts"
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8")

test("Admin and Administration open the same secured provider setup at each actual workflow",()=>{
 const platform=read("app/(app)/admin/platform/page.tsx")
 const administration=read("app/(app)/portals/administration/modules/[slug]/page.tsx")
 const sales=read("app/(app)/sales/page.tsx")
 const adminNavigation=read("lib/admin-administration-navigation.ts")
 const panel=read("components/admin/external-services-readiness.tsx")
 assert.doesNotMatch(platform,/ExternalServicesReadiness/)
 assert.equal((administration.match(/<ExternalServicesReadiness /g)||[]).length,1)
 assert.equal((sales.match(/<ExternalServicesReadiness /g)||[]).length,1)
 for(const slug of ["contracts","invoices","banking","ticketing","documents"])assert.ok(administration.includes('"'+slug+'"'),slug)
 for(const slug of ["contracts","invoices","banking","ticketing","documents"])assert.ok(adminNavigation.includes('slug:"'+slug+'"'),slug)
 assert.match(panel,/ProviderConnectionProbe/)
 assert.match(panel,/service\.id==="sumup"/)
 assert.match(panel,/service\.id==="documenso"/)
 assert.match(panel,/service\.id==="banking"/)
 assert.doesNotMatch(panel,/input[^>]+type="password"|NEXT_PUBLIC_SUMUP_API_KEY|NEXT_PUBLIC_PONTO_CLIENT_SECRET/)
})

test("provider credential diagnostics grant both Head Admin and active Administration assignments",()=>{
 const route=read("app/api/admin/provider-connection-check/route.ts")
 const permission=read("lib/administration/page-access.ts")
 assert.match(route,/requestHasSameOrigin\(request\)/)
 assert.match(route,/integrationManagementAccess\(\)/)
 assert.match(route,/if\(!access\.ok\)return fail/)
 assert.match(permission,/getCurrentUser\(\)/)
 assert.match(permission,/upt_my_portal_assignments/)
 assert.match(permission,/canOpenPortal\('administration'/)
 assert.match(permission,/user\.realIsAdmin\|\|user\.isOwner/)
 assert.match(route,/value!=="sumup"&&value!=="documenso"&&value!=="banking"/)
 assert.match(route,/size>256/)
 assert.match(route,/"Cache-Control":"no-store"/)
 assert.match(route,/checkProviderConnection\(/)
 assert.doesNotMatch(route,/res\.json\(provider|secret|apiKey|accessToken|PONTO_CLIENT_SECRET/)
})

test("provider checks only probe credentials, never write payment, financial or signing data",()=>{
 const src=read("lib/administration/provider-connection-check.ts")
 for(const url of ["https://api.sumup.com/v0.1/me","/api/v2/envelope?perPage=1","https://api.myponto.com/oauth2/token"])assert.ok(src.includes(url),url)
 assert.match(src,/method:"GET"/)
 assert.match(src,/grant_type=client_credentials/)
 assert.match(src,/redirect:"error"/)
 assert.match(src,/AbortSignal\.timeout\(6500\)/)
 assert.match(src,/json\.access_token\.length>10/)
 assert.doesNotMatch(src,/\/checkouts|\/payments|\/distribute|\/transactions|\/sync|\bPUT\b|\bDELETE\b/)
})

test("presence of provider credentials stays distinct from tested and enabled delivery",()=>{
 const empty=externalServicesReadiness({})
 for(const id of ["documenso","sumup","banking"])assert.notEqual(empty.find(x=>x.id===id)?.state,"credentials_present")
 const configured=externalServicesReadiness({
  DOCUMENSO_BASE_URL:"https://app.documenso.com",DOCUMENSO_API_KEY:"fake",
  SUMUP_API_KEY:"fake",SUMUP_MERCHANT_CODE:"fake",
  PONTO_CLIENT_ID:"fake",PONTO_CLIENT_SECRET:"fake"
 })
 for(const id of ["documenso","sumup","banking"])assert.equal(configured.find(x=>x.id===id)?.state,"credentials_present",id)
 const client=read("components/admin/provider-connection-probe.tsx")
 assert.match(client,/scope|connection-check/)
 assert.match(client,/features not activated/)
 assert.match(client,/funcies? nog niet geactiveerd|functies nog niet geactiveerd/)
 for(const label of ["nl:","fr:","en:","de:"])assert.ok(client.includes(label))
})


test("revoked, unapproved and blocked Administration accounts cannot access credential diagnostics",()=>{
 const access=read("lib/administration/page-access.ts")
 const portal=read("lib/portal-access.ts")
 assert.match(access,/user\.approved\|\|user\.account_blocked/)
 assert.match(portal,/assignment\.approved/)
 assert.match(portal,/assignment\.revoked_at === null/)
 assert.match(portal,/!account\.approved \|\| account\.blocked/)
 const route=read("app/api/admin/provider-connection-check/route.ts")
 assert.doesNotMatch(route,/request\.json\(\).*secret|service_role|SUPABASE_SERVICE_ROLE_KEY/)
})

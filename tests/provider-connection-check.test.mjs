import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {externalServicesReadiness} from "../lib/administration/external-services-readiness.ts"
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8")

test("connection probe is only available inside the existing Admin platform services panel",()=>{
 const page=read("app/(app)/admin/platform/page.tsx")
 const panel=read("components/admin/external-services-readiness.tsx")
 assert.equal((page.match(/<ExternalServicesReadiness /g)||[]).length,1)
 assert.match(panel,/ProviderConnectionProbe/)
 assert.match(panel,/service\.id==="sumup"/)
 assert.match(panel,/service\.id==="documenso"/)
 assert.match(panel,/service\.id==="banking"/)
 assert.doesNotMatch(panel,/input[^>]+type="password"|NEXT_PUBLIC_SUMUP_API_KEY|NEXT_PUBLIC_PONTO_CLIENT_SECRET/)
})

test("connection route is protected with same-origin and head-admin identity",()=>{
 const route=read("app/api/admin/provider-connection-check/route.ts")
 assert.match(route,/requestHasSameOrigin\(request\)/)
 assert.match(route,/getCurrentUser\(\)/)
 assert.match(route,/user\.approved/)
 assert.match(route,/user\.account_blocked/)
 assert.match(route,/user\.realIsAdmin\|\|user\.isOwner/)
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

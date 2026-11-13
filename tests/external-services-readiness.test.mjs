import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {externalServicesReadiness,externalServicesCopy} from "../lib/administration/external-services-readiness.ts"
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8")

test("external connection dashboard never represents stored keys as a verified integration",()=>{
 const values=externalServicesReadiness({})
 assert.deepEqual(values.map(s=>s.id),["cloudmersive","documenso","peppol","weeztix","eventix","eventpay","sumup","banking"])
 assert.equal(values.find(s=>s.id==="cloudmersive")?.state,"needs_configuration")
 assert.equal(values.find(s=>s.id==="documenso")?.state,"needs_configuration")
 assert.equal(values.find(s=>s.id==="peppol")?.state,"provider_required")
 assert.equal(values.find(s=>s.id==="weeztix")?.state,"manual_available")
 assert.equal(values.find(s=>s.id==="eventpay")?.state,"provider_required")
 assert.deepEqual(values.find(s=>s.id==="eventpay")?.setupVariables,[])
 assert.equal(values.find(s=>s.id==="eventpay")?.docsUrl,"https://eventpay.be/integraties/")
 assert.equal(externalServicesReadiness({EVENTPAY_API_KEY:"unverified-key"}).find(s=>s.id==="eventpay")?.state,"provider_required")
 for(const locale of ["nl","fr","en","de"]){
  assert.ok(externalServicesCopy[locale].names.eventpay.includes("EventPay"))
  assert.ok(externalServicesCopy[locale].instructions.eventpay.includes("EventPay"))
  assert.ok(!externalServicesCopy[locale].names.sumup.toLowerCase().includes("tokens"),"SumUp must not be shown as EventPay cashless")
 }

 const withKeys=externalServicesReadiness({
  CLOUDMERSIVE_OCR_API_KEY:"test-only-secret",
  DOCUMENSO_BASE_URL:"https://signature.example.com",
  DOCUMENSO_API_KEY:"test-only-token"
 })
 assert.equal(withKeys.find(s=>s.id==="cloudmersive")?.state,"credentials_present")
 assert.equal(withKeys.find(s=>s.id==="documenso")?.state,"credentials_present")
 assert.equal(withKeys.find(s=>s.id==="peppol")?.state,"provider_required")
 assert.deepEqual(externalServicesReadiness({DOCUMENSO_BASE_URL:"http://example.com",DOCUMENSO_API_KEY:"test-only"}).find(s=>s.id==="documenso")?.state,"needs_configuration")
 assert.equal(externalServicesReadiness({DOCUMENSO_BASE_URL:"https://127.0.0.1",DOCUMENSO_API_KEY:"test"}).find(s=>s.id==="documenso")?.state,"needs_configuration")
})

test("setup guidance lives only in each owning workflow, not in Admin platform or general settings",()=>{
 const platform=read("app/(app)/admin/platform/page.tsx")
 const modules=read("app/(app)/portals/administration/modules/[slug]/page.tsx")
 const sales=read("app/(app)/sales/page.tsx")
 const panel=read("components/admin/external-services-readiness.tsx")
 const helper=read("lib/administration/external-services-readiness.ts")
 const placement=read("lib/administration/integration-placement.ts")
 assert.doesNotMatch(platform,/ExternalServicesReadiness|externalServicesReadiness/)
 assert.doesNotMatch(modules,/slug==="settings"&&<ExternalServicesReadiness/)
 assert.match(modules,/integrationServicesForWorkspace\(slug,externalServicesReadiness\(process\.env\)\)/)
 assert.match(sales,/integrationServicesForWorkspace\('sales',externalServicesReadiness\(process\.env\)\)/)
 assert.match(panel,/t\.names\[service\.id\]/)
 assert.match(panel,/t\.instructions\[service\.id\]/)
 assert.match(panel,/t\.states\[service\.state\]/)
 assert.doesNotMatch(panel,/process\.env|apiKey|secrets\[|JSON\.stringify\(services\)/i)
 assert.match(placement,/contracts:\["documenso"\]/)
 assert.match(placement,/invoices:\["peppol"\]/)
 assert.match(placement,/ticketing:\["weeztix","eventix"\]/)
 assert.match(placement,/sales:\["sumup","eventpay"\]/)
 for(const locale of ["nl:","fr:","en:","de:"]){
  assert.ok(helper.includes(locale),locale)
  assert.ok(externalServicesCopy[locale.slice(0,2)].title)
 }
})

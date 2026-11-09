import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {externalServicesReadiness,externalServicesCopy} from "../lib/administration/external-services-readiness.ts"
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8")

test("external connection dashboard never represents stored keys as a verified integration",()=>{
 const values=externalServicesReadiness({})
 assert.deepEqual(values.map(s=>s.id),["cloudmersive","documenso","peppol","weeztix","eventix","sumup","banking"])
 assert.equal(values.find(s=>s.id==="cloudmersive")?.state,"needs_configuration")
 assert.equal(values.find(s=>s.id==="documenso")?.state,"needs_configuration")
 assert.equal(values.find(s=>s.id==="peppol")?.state,"provider_required")
 assert.equal(values.find(s=>s.id==="weeztix")?.state,"manual_available")
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

test("setup information is integrated only into existing Admin platform release panel and no secrets are rendered",()=>{
 const panel=read("components/admin/external-services-readiness.tsx")
 const page=read("app/(app)/admin/platform/page.tsx")
 const helper=read("lib/administration/external-services-readiness.ts")
 assert.match(page,/ExternalServicesReadiness locale=\{locale\} services=\{externalServices\}/)
 assert.match(page,/externalServicesReadiness\(process\.env\)/)
 assert.equal((page.match(/<ExternalServicesReadiness /g)||[]).length,1)
 assert.match(panel,/t\.names\[service\.id\]/)
 assert.match(panel,/t\.instructions\[service\.id\]/)
 assert.match(panel,/t\.states\[service\.state\]/)
 assert.match(panel,/service\.setupVariables\.map/)
 assert.doesNotMatch(panel,/process\.env|apiKey|\.value\}|secrets\[|JSON\.stringify\(services\)/i)
 assert.doesNotMatch(helper,/validated_live|verified_live|liveVerified:true/)
 for(const locale of ["nl:","fr:","en:","de:"]){
  assert.ok(helper.includes(locale),locale)
  assert.ok(externalServicesCopy[locale.slice(0,2)].title)
 }
})

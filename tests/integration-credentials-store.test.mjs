import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {sealIntegrationSecrets,openIntegrationSecrets} from "../lib/administration/integration-crypto.ts"
import {parseIntegrationConfiguration,integrationProviders,integrationFields} from "../lib/administration/integration-credentials.ts"
const src=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8")
const key=Buffer.alloc(32,11).toString("base64")
const other=Buffer.alloc(32,12).toString("base64")

test("AES-256-GCM credentials roundtrip, random IV, provider binding and tamper detection",async()=>{
 const fields={SUMUP_API_KEY:"sk_test_secret_synthetic_123",SUMUP_MERCHANT_CODE:"mer-123"}
 const first=await sealIntegrationSecrets("sumup",fields,key)
 const second=await sealIntegrationSecrets("sumup",fields,key)
 assert.notEqual(first,second)
 assert.ok(first.startsWith("v1:"))
 assert.ok(!first.includes(fields.SUMUP_API_KEY))
 assert.deepEqual(await openIntegrationSecrets("sumup",first,key),fields)
 await assert.rejects(()=>openIntegrationSecrets("banking",first,key))
 await assert.rejects(()=>openIntegrationSecrets("sumup",first,other))
 await assert.rejects(()=>openIntegrationSecrets("sumup",first.slice(0,-4)+"AAAA",key))
 await assert.rejects(()=>sealIntegrationSecrets("sumup",fields,"not-a-256-bit-key"))
})

test("provider credential validation blocks arbitrary fields and SSRF targets",()=>{
 assert.deepEqual(integrationProviders,["sumup","documenso","banking","weeztix","peppol"])
 for(const provider of integrationProviders)assert.ok(integrationFields[provider].length===2,provider)
 const good={DOCUMENSO_BASE_URL:"https://app.documenso.com",DOCUMENSO_API_KEY:"synthetic-token"}
 assert.deepEqual(parseIntegrationConfiguration("documenso",good),good)
 assert.equal(parseIntegrationConfiguration("documenso",{...good,DOCUMENSO_BASE_URL:"https://127.0.0.1"}),null)
 assert.equal(parseIntegrationConfiguration("documenso",{...good,DOCUMENSO_BASE_URL:"https://evil.example"}),null)
 assert.equal(parseIntegrationConfiguration("sumup",{SUMUP_API_KEY:"synthetic",SUMUP_MERCHANT_CODE:"merchant",ADMIN:"yes"}),null)
 assert.equal(parseIntegrationConfiguration("sumup",{SUMUP_API_KEY:"synthetic\n",SUMUP_MERCHANT_CODE:"merchant"}),null)
 assert.equal(parseIntegrationConfiguration("weeztix",{WEEZTIX_ACCESS_TOKEN:"synthetic",WEEZTIX_ACTIVE_EVENT_ID:"not-a-uuid"}),null)
})

test("private database store denies table grants and audits all edits without plaintext",()=>{
 const migration=src("supabase/migrations/20261109210825_admin_integrations_encrypted_store.sql")
 assert.match(migration,/upt_private\.integration_connections/)
 assert.match(migration,/upt_private\.integration_connection_audit/)
 assert.match(migration,/enable row level security/)
 assert.match(migration,/revoke all on upt_private\.integration_connections from public, anon, authenticated/)
 assert.match(migration,/grant execute on function public\.upt_integration_credentials\(text,text,text\) to authenticated/)
 assert.match(migration,/p\.account_blocked/)
 assert.match(migration,/public\.upt_can_manage_administration\(\)/)
 for(const action of ["connected","updated","disconnected"])assert.ok(migration.includes(action))
 assert.doesNotMatch(migration,/jsonb_build_object\([^)]*'plaintext'|to authenticated using \(true\)/)
})

test("no provider tokens are returned from GET, save or disconnect browser responses",()=>{
 const api=src("app/api/administration/integrations/route.ts")
 const store=src("lib/administration/integration-store.ts")
 const ui=src("components/admin/integration-credential-manager.tsx")
 const wrapper=src("components/admin/external-services-readiness.tsx")
 for(const pattern of [/requestHasSameOrigin\(request\)/,/administrationPageAccess\(\)/,/smallJson\(request,10240\)/,/smallJson\(request,512\)/,/Cache-Control/,/saveIntegrationCredentials/,/disconnectIntegration/])assert.match(api,pattern)
 assert.match(store,/UPT_INTEGRATION_ENCRYPTION_KEY/)
 assert.match(store,/sealIntegrationSecrets/)
 assert.match(store,/openIntegrationSecrets/)
 assert.match(store,/upt_integration_credentials/)
 assert.match(wrapper,/IntegrationCredentialManager initialLocale=\{locale\}/)
 assert.match(ui,/\?"text":"password"/)
 assert.match(ui,/setFields\(\{\}\)/)
 assert.match(ui,/confirm/)
 assert.doesNotMatch(api,/ciphertext:|secret:|access_token:|apiKey:/)
 for(const locale of ["nl:","fr:","en:","de:"])assert.ok(ui.includes(locale))
})

test("server-side provider tests prefer encrypted in-app configuration, not only Cloudflare keys",()=>{
 const route=src("app/api/admin/provider-connection-check/route.ts")
 assert.match(route,/getManagedIntegrationConfig\(access\.db,value as ConnectionProvider\)/)
 assert.match(route,/checkProviderConnection\(value as ConnectionProvider,environment\)/)
 assert.match(route,/administrationPageAccess/)
 assert.match(route,/integration_storage_unavailable/)
})

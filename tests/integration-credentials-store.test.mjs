import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {sealIntegrationSecrets,openIntegrationSecrets,validIntegrationMasterKey} from "../lib/administration/integration-crypto.ts"
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
 for(const provider of integrationProviders)assert.equal(integrationFields[provider].length,provider==="weeztix"?3:2,provider)
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

test("encryption key readiness confirms correct AES-256 binary material, not mere environment presence",()=>{
 assert.equal(validIntegrationMasterKey(key),true)
 assert.equal(validIntegrationMasterKey(other),true)
 for(const v of ["",undefined,"a-not-base64-secret","a".repeat(43),"AA==",key+"\n"," "+key,key.slice(0,-1)+"?"])assert.equal(validIntegrationMasterKey(v),false,String(v))
 const api=src("app/api/administration/integrations/route.ts")
 assert.match(api,/validIntegrationMasterKey\(process\.env\.UPT_INTEGRATION_ENCRYPTION_KEY\)/)
})

test("integration audit reads metadata only, with deny-by-default direct access and role-scoped RPC",()=>{
 const migration=src("supabase/migrations/20261109221102_integration_audit_history_ui.sql")
 assert.match(migration,/public\.upt_integration_audit_recent\(p_limit integer default 20\)/)
 assert.match(migration,/public\.upt_can_manage_administration\(\)/)
 assert.match(migration,/p\.account_blocked/)
 assert.match(migration,/revoke all on function public\.upt_integration_audit_recent/)
 assert.match(migration,/upt_private\.integration_connection_audit/)
 const api=src("app/api/administration/integrations/route.ts")
 const ui=src("components/admin/integration-credential-manager.tsx")
 assert.match(api,/listRecentIntegrationAudit\(access\.db\)/)
 assert.match(ui,/auditTitle/)
 assert.match(ui,/auditBy/)
 assert.doesNotMatch(migration.replace(/^--.*$/gm,""),/encrypted_credentials|ciphertext/)
})

test("provider readiness reflects encrypted in-app credentials without duplicate menus or public API fields",()=>{
 const panel=src("components/admin/external-services-readiness.tsx")
 assert.match(panel,/administrationPageAccess\(\)/)
 assert.match(panel,/listIntegrationSummaries\(access\.db\)/)
 assert.match(panel,/appManaged\.has\(service\.id/)
 assert.match(panel,/t\.states\.credentials_present/)
 assert.equal((panel.match(/<IntegrationCredentialManager /g)||[]).length,1)
})

test("Weeztix scanner access requires explicit per-event activation",()=>{
 const event="14114341-a820-4eb4-a5af-232000cf051d"
 const credentials={WEEZTIX_ACCESS_TOKEN:"provider-issued-token",WEEZTIX_ACTIVE_EVENT_ID:event,WEEZTIX_SCANNING_ENABLED:"true"}
 assert.deepEqual(parseIntegrationConfiguration("weeztix",credentials),credentials)
 assert.equal(parseIntegrationConfiguration("weeztix",{...credentials,WEEZTIX_SCANNING_ENABLED:"anything"}),null)
 assert.equal(parseIntegrationConfiguration("weeztix",{...credentials,WEEZTIX_SCANNING_ENABLED:"TRUE"}),null)
 assert.equal(parseIntegrationConfiguration("weeztix",{...credentials,WEEZTIX_ACTIVE_EVENT_ID:"wrong-event"}),null)
 const ui=src("components/admin/integration-credential-manager.tsx")
 assert.match(ui,/WEEZTIX_SCANNING_ENABLED:"false"/)
 assert.match(ui,/type="checkbox"/)
 assert.match(ui,/event.target.checked\?"true":"false"/)
})

test("Weeztix server integration uses role-scoped encrypted credentials and fails closed",()=>{
 const route=src("app/api/weeztix/scan/route.ts")
 const server=src("lib/administration/integration-store.ts")
 const migration=src("supabase/migrations/20261109223132_weeztix_scoped_encrypted_scan_settings.sql")
 assert.match(route,/getScopedWeeztixScanConfig\(db,eventId,workplaceId\)/)
 assert.match(route,/managed.WEEZTIX_SCANNING_ENABLED!=="true"/)
 assert.match(route,/managed.WEEZTIX_ACTIVE_EVENT_ID!==eventId/)
 assert.match(route,/process.env.WEEZTIX_SCANNING_ENABLED!=="true"/)
 assert.match(route,/Authorization:"Bearer "\+accessToken/)
 assert.match(route,/if\(response.status===204\)/)
 assert.match(server,/upt_weeztix_scan_secrets/)
 assert.match(server,/openIntegrationSecrets\("weeztix"/)
 assert.match(migration,/public.upt_weeztix_scan_secrets/)
 assert.match(migration,/auth.uid\(\)/)
 assert.match(migration,/p.account_blocked/)
 assert.match(migration,/public.upt_is_admin\(v_uid\)/)
 assert.match(migration,/public.shifts/)
 assert.match(migration,/public.responsible_assignments/)
 assert.match(migration,/w.is_active is true/)
 assert.match(migration,/e.status is distinct from 'archived'/)
 assert.match(migration,/revoke all on function public.upt_weeztix_scan_secrets/)
 assert.match(migration,/grant execute on function public.upt_weeztix_scan_secrets\(uuid,uuid\) to authenticated/)
 assert.doesNotMatch(route,/return NextResponse.json\(\{[^}]*accessToken/)
})

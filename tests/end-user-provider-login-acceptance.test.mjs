import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseIntegrationConfiguration} from '../lib/administration/integration-credentials.ts'

const read=p=>readFileSync(p,'utf8')
const source=read('lib/administration/provider-user-oauth.ts')
const refresh=read('lib/administration/provider-user-oauth-refresh.ts')
const start=read('app/api/administration/integrations/oauth/[provider]/start/route.ts')
const callback=read('app/api/administration/integrations/oauth/[provider]/callback/route.ts')
const ui=read('components/admin/external-services-readiness.tsx')+read('lib/administration/external-services-view-data.ts')
const previousWeeztixStart=read('app/api/administration/integrations/weeztix/start/route.ts')
const previousWeeztixCallback=read('app/api/administration/integrations/weeztix/callback/route.ts')
const api=read('app/api/administration/integrations/route.ts')

test('end-user SumUp and Billit login stores only validated OAuth token sets, never arbitrary fields',()=>{
 const token='provider-issued-test-token-123456789'
 const access={SUMUP_OAUTH_ACCESS_TOKEN:token,SUMUP_OAUTH_REFRESH_TOKEN:token,SUMUP_OAUTH_EXPIRES_AT:'1999999999'}
 assert.deepEqual(parseIntegrationConfiguration('sumup',access),access)
 assert.equal(parseIntegrationConfiguration('sumup',{...access,SUMUP_OAUTH_EXPIRES_AT:'NaN'}),null)
 assert.equal(parseIntegrationConfiguration('sumup',{...access,EVIL:'1'}),null)
 const peppol={BILLIT_OAUTH_ACCESS_TOKEN:token,BILLIT_OAUTH_REFRESH_TOKEN:token,
  BILLIT_OAUTH_EXPIRES_AT:'1999999999',BILLIT_OAUTH_ENV:'sandbox'}
 assert.deepEqual(parseIntegrationConfiguration('peppol',peppol),peppol)
 assert.equal(parseIntegrationConfiguration('peppol',{...peppol,BILLIT_OAUTH_ENV:'other'}),null)
 assert.equal(parseIntegrationConfiguration('peppol',{...peppol,BILLIT_OAUTH_ENV:'production',BILLIT_OAUTH_REFRESH_TOKEN:'\n'}),null)
})
test('client secrets belong to platform registration, callback URI is exact and state is user bound',()=>{
 for(const setting of ['UPT_SUMUP_OAUTH_CLIENT_ID','UPT_SUMUP_OAUTH_CLIENT_SECRET','UPT_BILLIT_OAUTH_CLIENT_ID','UPT_BILLIT_OAUTH_CLIENT_SECRET'])
  assert.ok(source.includes(setting),setting)
 for(const fixed of ['https://api.sumup.com/authorize','https://api.sumup.com/token',
  'https://my.sandbox.billit.be/Account/Logon','https://api.sandbox.billit.be/OAuth2/token'])
  assert.ok(source.includes(fixed),fixed)
 assert.match(source,/userOAuthCallbackUrl/)
 assert.match(source,/UPT_PROVIDER_OAUTH_ORIGIN/)
 assert.match(source,/const host=request.headers.get\("host"\)\?\.toLowerCase\(\)/)
 assert.match(source,/diff\|=expected.charCodeAt\(i\)\^actual.charCodeAt\(i\)/)
 assert.match(start,/integrationManagementAccess\(\)/)
 assert.match(start,/validIntegrationMasterKey\(process.env.UPT_INTEGRATION_ENCRYPTION_KEY\)/)
 assert.match(start,/sameSite:"lax",maxAge:600/)
 assert.match(start,/state\+":"\+access.user.id/)
 assert.match(callback,/verifyOAuthState\(stored.slice\(0,sep\),state\)/)
 assert.match(callback,/stored.slice\(sep\+1\)!==access.user.id/)
 assert.match(callback,/saveIntegrationCredentials\(access.db,provider,oauthStoredConfiguration\(provider,tokens\)\)/)
 assert.match(callback,/maxAge:0,path:/)
 assert.doesNotMatch(callback,/return.*access_token|return.*refresh_token|JSON.stringify\(tokens\)/)
})
test('tokens are strictly server-side, bounded and fail closed on expired or revoked consent',()=>{
 assert.match(source,/AbortSignal.timeout\(8000\)/)
 assert.match(source,/redirect:"error"/)
 assert.match(source,/length>16000/)
 assert.match(source,/p.expires_in<60/)
 assert.match(refresh,/refreshUserOAuthToken\(provider,refresh\)/)
 assert.match(refresh,/oauth_reauthorization_required/)
 assert.match(refresh,/await saveIntegrationCredentials\(db,provider,next\)/)
 const diagnostic=read('app/api/admin/provider-connection-check/route.ts')
 assert.match(diagnostic,/authorizedProviderOAuthConfig\(access.db,value\)/)
 assert.match(diagnostic,/provider_reauthorization_required/)
 assert.match(api,/value.provider==="sumup"\|\|value.provider==="peppol"/)
 assert.match(api,/connect_via_provider_login/)
})
test('end user sees account login in functional modules, not API key forms',()=>{
 assert.match(ui,/oauthReady\[service.id\]/)
 assert.match(ui,/integrations\/oauth\/"\+service.id\+"\/start"/)
 assert.match(ui,/name="eventId"/)
 assert.match(ui,/integrations\/weeztix\/start/)
 assert.match(ui,/connectionNeedsProvider/)
 assert.doesNotMatch(ui,/<IntegrationCredentialManager /)
 for(const locale of ['nl','fr','en','de']){
  assert.ok(ui.includes(locale+':{'),'Missing connection locale '+locale)
 }
 const manager=read('components/admin/integration-credential-manager.tsx')
 assert.match(manager,/Weeztix veilig verbinden/) // legacy code kept, not mounted to customers
})
test('Weeztix customer selects event and consents using platform OAuth app, never enters own client secret',()=>{
 assert.match(previousWeeztixStart,/UPT_WEEZTIX_OAUTH_CLIENT_ID/)
 assert.match(previousWeeztixStart,/UPT_WEEZTIX_OAUTH_CLIENT_SECRET/)
 assert.match(previousWeeztixStart,/access.db.from\("events"\)/)
 assert.match(previousWeeztixStart,/state\+":"\+access.user.id\+":"\+eventId/)
 assert.match(previousWeeztixCallback,/expected.slice\(first\+1,second\)/)
 assert.match(previousWeeztixCallback,/UPT_WEEZTIX_OAUTH_CLIENT_ID/)
 assert.match(previousWeeztixCallback,/WEEZTIX_ACTIVE_EVENT_ID:eventId/)
 assert.match(previousWeeztixCallback,/WEEZTIX_SCANNING_ENABLED:"true"/)
 assert.match(previousWeeztixCallback,/saveIntegrationCredentials\(access.db,"weeztix"/)
})

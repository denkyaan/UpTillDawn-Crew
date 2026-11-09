import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {
 parseWeeztixOAuthTokenResponse,WEEZTIX_TOKEN_ENDPOINT,weeztixCallbackUrl
} from "../lib/administration/weeztix-oauth.ts"
import {parseIntegrationConfiguration} from "../lib/administration/integration-credentials.ts"
const src=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8")
const event="14114341-a820-4eb4-a5af-232000cf051d"

test("Weeztix OAuth issued tokens are strictly parsed with computed expiry",()=>{
 const expiry=Date.UTC(2026,10,9,18,0,0)
 const tokens=parseWeeztixOAuthTokenResponse({
  token_type:"Bearer",access_token:"synthetic_access_token_A",refresh_token:"synthetic_refresh_token_B",expires_in:259200
 },expiry)
 assert.deepEqual(tokens,{
  WEEZTIX_ACCESS_TOKEN:"synthetic_access_token_A",
  WEEZTIX_REFRESH_TOKEN:"synthetic_refresh_token_B",
  WEEZTIX_TOKEN_EXPIRES_AT:String(Math.floor(expiry/1000)+259200-30)
 })
 for(const input of [
  null,{},[],{token_type:"bearer",access_token:"token1234567",refresh_token:"refresh1234567",expires_in:259200},
  {token_type:"Bearer",access_token:"short",refresh_token:"refresh1234567",expires_in:259200},
  {token_type:"Bearer",access_token:"token1234567",refresh_token:"short",expires_in:259200},
  {token_type:"Bearer",access_token:"token1234567",refresh_token:"refresh1234567",expires_in:0},
  {token_type:"Bearer",access_token:"token1234567",refresh_token:"refresh1234567",expires_in:9e9},
  {token_type:"Bearer",access_token:"token1234567\n",refresh_token:"refresh1234567",expires_in:259200}
 ])assert.equal(parseWeeztixOAuthTokenResponse(input),null)
 assert.equal(WEEZTIX_TOKEN_ENDPOINT,"https://auth.weeztix.com/tokens")
})

test("OAuth-managed Weeztix settings remain validated, legacy token stays backwards compatible",()=>{
 const legacy={WEEZTIX_ACCESS_TOKEN:"manual-provider-token",WEEZTIX_ACTIVE_EVENT_ID:event,WEEZTIX_SCANNING_ENABLED:"false"}
 assert.deepEqual(parseIntegrationConfiguration("weeztix",legacy),legacy)
 const newConfig={...legacy,WEEZTIX_ACCESS_TOKEN:"",WEEZTIX_CLIENT_ID:"client-id-123",WEEZTIX_CLIENT_SECRET:"client-secret-123"}
 assert.deepEqual(parseIntegrationConfiguration("weeztix",newConfig),newConfig)
 const rotated={...newConfig,WEEZTIX_ACCESS_TOKEN:"access_token_123",WEEZTIX_REFRESH_TOKEN:"refresh_token_123",WEEZTIX_TOKEN_EXPIRES_AT:"1794012345"}
 assert.deepEqual(parseIntegrationConfiguration("weeztix",rotated),rotated)
 assert.equal(parseIntegrationConfiguration("weeztix",{...newConfig,WEEZTIX_CLIENT_SECRET:""}),null)
 assert.equal(parseIntegrationConfiguration("weeztix",{...rotated,WEEZTIX_TOKEN_EXPIRES_AT:"yesterday"}),null)
 assert.equal(parseIntegrationConfiguration("weeztix",{...newConfig,WEEZTIX_REFRESH_TOKEN:"token_without_expiry"}),null)
 assert.equal(parseIntegrationConfiguration("weeztix",{...newConfig,UNEXPECTED_FIELD:"bad"}),null)
 assert.equal(parseIntegrationConfiguration("weeztix",{...newConfig,WEEZTIX_SCANNING_ENABLED:"enabled"}),null)
})

test("OAuth uses a fixed main callback address and disallows arbitrary origins",()=>{
 const valid=new Request("https://uptilldawn-main.uptilldawn.workers.dev/anything",{headers:{host:"uptilldawn-main.uptilldawn.workers.dev"}})
 assert.equal(weeztixCallbackUrl(valid),"https://uptilldawn-main.uptilldawn.workers.dev/api/administration/integrations/weeztix/callback")
 const invalid=new Request("https://attacker.example/anything",{headers:{host:"attacker.example"}})
 assert.throws(()=>weeztixCallbackUrl(invalid),/oauth_origin_unavailable/)
 const start=src("app/api/administration/integrations/weeztix/start/route.ts")
 const callback=src("app/api/administration/integrations/weeztix/callback/route.ts")
 for(const file of [start,callback])assert.match(file,/integrationManagementAccess\(\)/)
 assert.match(start,/response\.cookies\.set\(WEEZTIX_OAUTH_STATE_COOKIE/)
 assert.match(start,/httpOnly:true/)
 assert.match(start,/sameSite:"lax"/)
 assert.match(start,/maxAge:600/)
 assert.match(start,/response_type","code"/)
 assert.match(callback,/sameState\(/)
 assert.match(callback,/access\.user\.id/)
 assert.match(callback,/maxAge:0/)
 assert.match(callback,/grant_type:"authorization_code"/)
 assert.match(callback,/saveIntegrationCredentials\(/)
 assert.match(callback,/outcome\(request,"connected"\)/)
 assert.doesNotMatch(callback,/console\.log\(|JSON\.stringify\(\{.*access_token/)
})

test("browser never supplies refresh tokens and OAuth status does not expose them",()=>{
 const api=src("app/api/administration/integrations/route.ts")
 const ui=src("components/admin/integration-credential-manager.tsx")
 const store=src("lib/administration/integration-store.ts")
 assert.match(api,/"WEEZTIX_REFRESH_TOKEN" in fields/)
 assert.match(api,/"WEEZTIX_TOKEN_EXPIRES_AT" in fields/)
 assert.match(api,/weeztixOauthReady/)
 assert.match(ui,/weeztixOauthReady/)
 assert.match(ui,/oauthConnect/)
 assert.match(ui,/weeztix\/start/)
 assert.match(ui,/useEffect\(\(\)=>\{setOauthResult/)
 assert.match(store,/previous\.WEEZTIX_REFRESH_TOKEN/)
 assert.match(store,/weeztixOAuthReadiness/)
})

test("Weeztix single-use refresh is transactionally leased and compare-and-swap committed",()=>{
 const sql=src("supabase/migrations/20261109225723_weeztix_oauth_refresh_leases.sql")
 const scanner=src("app/api/weeztix/scan/route.ts")
 const refresh=src("lib/administration/weeztix-refresh.ts")
 const store=src("lib/administration/integration-store.ts")
 for(const term of [
  "upt_private.weeztix_refresh_leases","upt_weeztix_claim_refresh","upt_weeztix_commit_refresh",
  "upt_weeztix_release_refresh","p_previous_ciphertext","p_new_ciphertext",
  "claim_id=p_claim_id","claimed_by=auth.uid()","lease_expires_at>now()",
  "encrypted_credentials=p_previous_ciphertext","enable row level security",
  "revoke all on upt_private.weeztix_refresh_leases"
 ])assert.ok(sql.includes(term),term)
 assert.match(scanner,/resolveManagedWeeztixAccessToken\(/)
 assert.match(refresh,/expires>now\+3600/)
 assert.match(refresh,/claimScopedWeeztixRefresh\(/)
 assert.match(refresh,/requestWeeztixOAuthTokens\(/)
 assert.match(refresh,/commitScopedWeeztixRefresh\(/)
 assert.match(refresh,/releaseScopedWeeztixRefresh\(/)
 assert.match(refresh,/provider_auth_refreshing/)
 assert.match(store,/p_previous_ciphertext/)
 assert.match(store,/p_new_ciphertext/)
 assert.match(store,/WEEZTIX_TOKEN_EXPIRES_AT/)
 assert.doesNotMatch(sql,/grant (?:select|update|insert) on upt_private\.weeztix_refresh_leases to authenticated/)
})

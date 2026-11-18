import "server-only"
import {getManagedIntegrationConfig,saveIntegrationCredentials} from "./integration-store"
import {refreshUserOAuthToken,oauthStoredConfiguration,type UserOAuthProvider} from "./provider-user-oauth"
import {createClient} from "@/lib/supabase/crew-server"
type Db=Awaited<ReturnType<typeof createClient>>

/** Browser never receives any token. Refresh on demand using UpTillDawn's OAuth app. */
export async function authorizedProviderOAuthConfig(db:Db,provider:UserOAuthProvider){
 const stored=await getManagedIntegrationConfig(db,provider)
 if(!stored)return null
 const prefix=provider==="sumup"?"SUMUP":"BILLIT"
 const access=stored[prefix+"_OAUTH_ACCESS_TOKEN"],refresh=stored[prefix+"_OAUTH_REFRESH_TOKEN"]
 const expiry=Number(stored[prefix+"_OAUTH_EXPIRES_AT"])
 if(!access||!refresh)return null // Legacy manual configuration is not OAuth.
 if(!Number.isSafeInteger(expiry))throw Error("oauth_config_unavailable")
 // Allow a 2-minute safety buffer. Invalid/revoked grants must be reauthorized.
 if(expiry>Date.now()/1000+120)return stored
 const rotated=await refreshUserOAuthToken(provider,refresh)
 if(!rotated)throw Error("oauth_reauthorization_required")
 const next=oauthStoredConfiguration(provider,rotated)
 // The stored environment must never silently jump from sandbox to production.
 if(provider==="peppol"&&next.BILLIT_OAUTH_ENV!==stored.BILLIT_OAUTH_ENV)
  throw Error("oauth_environment_changed")
 await saveIntegrationCredentials(db,provider,next)
 return next
}

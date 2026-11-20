import "server-only"
import {createClient} from "@/lib/supabase/crew-server"
import {
 claimScopedWeeztixRefresh,commitScopedWeeztixRefresh,
 getScopedWeeztixConnection,releaseScopedWeeztixRefresh,
 type ScopedWeeztixConnection
} from "@/lib/administration/integration-store"
import {requestWeeztixOAuthTokens} from "@/lib/administration/weeztix-oauth"

type Db=Awaited<ReturnType<typeof createClient>>
type TokenResolution={token:string|null;reason:"provider_auth_expired"|"provider_auth_refreshing"|"provider_unavailable"|null}
const valid=(access:unknown):access is string=>typeof access==="string"&&access.length>3

/**
 * Refresh at most once when a token is within one hour of expiry.
 * The Postgres lease enforces one refresh per organization despite many scanners.
 * Losers keep a still-valid token or fail closed until rotation is committed.
 */
export async function resolveManagedWeeztixAccessToken(db:Db,eventId:string,workplaceId:string,
 connection:ScopedWeeztixConnection):Promise<TokenResolution>{
 const {config,ciphertext}=connection
 const current=config.WEEZTIX_ACCESS_TOKEN
 const expires=Number(config.WEEZTIX_TOKEN_EXPIRES_AT)
 const hasRefresh=valid(config.WEEZTIX_REFRESH_TOKEN)&&
   valid(config.WEEZTIX_CLIENT_ID)&&valid(config.WEEZTIX_CLIENT_SECRET)&&
   Number.isSafeInteger(expires)&&expires>0
 if(!hasRefresh)return valid(current)?{token:current,reason:null}:{token:null,reason:"provider_auth_expired"}
 const now=Math.floor(Date.now()/1000)
 if(expires>now+3600)return {token:current??null,reason:null}

 let claimId:string|null=null
 try{claimId=await claimScopedWeeztixRefresh(db,eventId,workplaceId)}
 catch{return valid(current)&&expires>now?{token:current,reason:null}:{token:null,reason:"provider_unavailable"}}
 if(!claimId){
  // A concurrent operator is already renewing. Never replay a refresh token.
  if(valid(current)&&expires>now+60)return {token:current,reason:null}
  return {token:null,reason:"provider_auth_refreshing"}
 }

 try{
  const tokens=await requestWeeztixOAuthTokens({
   grant_type:"refresh_token",refresh_token:config.WEEZTIX_REFRESH_TOKEN!,
   client_id:config.WEEZTIX_CLIENT_ID!,client_secret:config.WEEZTIX_CLIENT_SECRET!
  })
  if(!tokens){
   return valid(current)&&expires>now+60?{token:current,reason:null}:{token:null,reason:"provider_auth_expired"}
  }
  const updated={...config,...tokens}
  const committed=await commitScopedWeeztixRefresh(db,eventId,workplaceId,claimId,ciphertext,updated)
  if(committed)return {token:tokens.WEEZTIX_ACCESS_TOKEN,reason:null}
  // Admin may have changed the connection while this token was being rotated.
  // Never overwrite it; prefer a freshly stored, explicitly enabled token.
  const fresh=await getScopedWeeztixConnection(db,eventId,workplaceId)
  if(fresh?.config.WEEZTIX_ACTIVE_EVENT_ID===eventId&&
     fresh.config.WEEZTIX_SCANNING_ENABLED==="true"&&
     valid(fresh.config.WEEZTIX_ACCESS_TOKEN))
    return {token:fresh.config.WEEZTIX_ACCESS_TOKEN,reason:null}
  return {token:null,reason:"provider_auth_refreshing"}
 }catch{
  return {token:null,reason:"provider_unavailable"}
 }finally{
  await releaseScopedWeeztixRefresh(db,eventId,workplaceId,claimId).catch(()=>{})
 }
}

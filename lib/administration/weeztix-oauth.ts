/** Fixed-host Weeztix OAuth endpoints; no user-supplied callback URL or token origin. */
export const WEEZTIX_AUTH_BASE="https://login.weeztix.com/login"
export const WEEZTIX_TOKEN_ENDPOINT="https://auth.weeztix.com/tokens"
export const WEEZTIX_OAUTH_STATE_COOKIE="upt_weeztix_oauth_state"
const CALLBACK="/api/administration/integrations/weeztix/callback"

export function weeztixCallbackUrl(request:Request):string{
 const host=request.headers.get("host")?.toLowerCase()
 if(host==="uptilldawn-main.uptilldawn.workers.dev")return "https://"+host+CALLBACK
 if(process.env.NODE_ENV!=="production"&&host&&/^(?:localhost|127\.0\.0\.1):[0-9]{2,5}$/.test(host))return "http://"+host+CALLBACK
 throw Error("weeztix_oauth_origin_unavailable")
}

export type WeeztixOAuthTokenResult={
 WEEZTIX_ACCESS_TOKEN:string
 WEEZTIX_REFRESH_TOKEN:string
 WEEZTIX_TOKEN_EXPIRES_AT:string
}
export function parseWeeztixOAuthTokenResponse(payload:unknown,now=Date.now()):WeeztixOAuthTokenResult|null{
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return null
 const data=payload as Record<string,unknown>
 if(data.token_type!=="Bearer"||typeof data.access_token!=="string"||
    typeof data.refresh_token!=="string"||
    data.access_token.length<10||data.access_token.length>4096||
    data.refresh_token.length<10||data.refresh_token.length>4096||
    /[\u0000-\u001f\u007f]/.test(data.access_token)||
    /[\u0000-\u001f\u007f]/.test(data.refresh_token)||
    typeof data.expires_in!=="number"||!Number.isInteger(data.expires_in)||
    data.expires_in<60||data.expires_in>31536000)return null
 const expiresAt=Math.floor(now/1000)+data.expires_in-30
 if(!Number.isSafeInteger(expiresAt))return null
 return {
  WEEZTIX_ACCESS_TOKEN:data.access_token,
  WEEZTIX_REFRESH_TOKEN:data.refresh_token,
  WEEZTIX_TOKEN_EXPIRES_AT:String(expiresAt)
 }
}
/** Bounded, fixed-host token exchange. Provider error details are never logged or forwarded. */
export async function requestWeeztixOAuthTokens(body:Record<string,string>):Promise<WeeztixOAuthTokenResult|null>{
 let response:Response
 try{
  response=await fetch(WEEZTIX_TOKEN_ENDPOINT,{
   method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
   body:JSON.stringify(body),
   redirect:"error",cache:"no-store",signal:AbortSignal.timeout(7000)
  })
 }catch{return null}
 if(!response.ok)return null
 const claimedSize=Number(response.headers.get("content-length")||"0")
 if(claimedSize>16000)return null
 let content:string
 try{content=await response.text()}catch{return null}
 if(content.length>16000)return null
 try{return parseWeeztixOAuthTokenResponse(JSON.parse(content))}catch{return null}
}

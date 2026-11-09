import {NextResponse} from "next/server"
import {verifyMainDeployOIDC} from "@/lib/administration/github-oidc-deploy-test"

/** Authenticated synthetic smoke test used only by the signed main GitHub
 * deployment identity. Never accepts user files or exposes the provider key.
 */
export const dynamic="force-dynamic"
const reply=(status:string,http:number,extra?:Record<string,unknown>)=>NextResponse.json({
 status,...extra
},{status:http,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})

const SYNTHETIC_PNG="iVBORw0KGgoAAAANSUhEUgAAAtAAAAB+AQAAAAAlpRuGAAACs0lEQVR42u2YPW7bQBBG31KMyCKImc5FALFMmQMENoscJLlBShdBuHaVY/gmXuckFJDCXVikoAyCk4Kk+C8pNgIEwWwhiNzh2+Hw+2YpGeFvDQ9FK1rRila0ohWtaEUrWtGK/hfQxsJ9NDy39RfDRcRd5mcZQQFcBUUglRGxpCJuU67EiP1ixKUiBWdSYQRSEQuBZSVwAWxkOrqsH0drfgOXg3Q/0R74xSMC3HaZnVIQscOZx27a1oCMiqJZpB3VSbV2o0pNYh1CDkC5P1eehM5GUxZbtFlZAHuBzc5GYUFxFL1xQWV6Rfna3EWFtfUdCffWuegNFBWk2aYgLYvz4Fpsmh3MOs5HQssAQ/sBGBKIPRjqLTlakJFe+Yh4ZXs+a55YZhNzqhkOROXT2Lip+jPRERUVAndzy/TE/iSjvwBbQlPc0if6acYxuyegw0ZVb/GgWF4/fErW5d42o6iqPb4Ow+W0u4vyaJqQBUs1MV3vyF9+sN6iGZtRkIEZtorQH/r/CHqbzFCxCWOHAJzvv60Wc+pXMZ7qLwE+AKRjOx3NeYCeN6yjnM61/ToteL+oeW+wO03s6MjrS+2SUVfueNbrcaVDtglxrdwY8Evy1wKQ92X+7nhTnboigwxupiUNy+dZJm/5RdcWs7oy/kntyQfibMYu0y7rVRB/uhODV/XL9udZ3+Iai0bNXQsOsmqwb+44vIE93M68n9gYKcDse53h0ibJw49u26k3p+gAOtrZnl12JhETcTPQsg9gv2PjXdzT4rXPNj6UdThvF2u7ZurVnjLNAxioPD6Anu9eBoM/kFaM1x67E7ddDzMzs24DbNxU95yXrDEDWjjj4h7auFczM1cy7tMBn9vYfbcL3HrxvVb/0Fe0ohWtaEUrWtGKVrSiFa1oRSta0YpWtKIV/b+hfwNgzemsa3uxEgAAAABJRU5ErkJggg=="

export async function POST(request:Request){
 const bearer=request.headers.get("authorization")||""
 if(!bearer.startsWith("Bearer ")||!await verifyMainDeployOIDC(bearer.slice(7))){
  return reply("unauthorized",401)
 }
 // The main Worker only. Production must never run this test.
 const workerHost="uptilldawn-main.uptilldawn.workers.dev"
 if(new URL(request.url).hostname!==workerHost)return reply("wrong_environment",403)
 const key=process.env.CLOUDMERSIVE_OCR_API_KEY
 if(!key)return reply("secret_missing",503)
 const data=new FormData()
 const bytes=Uint8Array.from(atob(SYNTHETIC_PNG),value=>value.charCodeAt(0))
 data.append("imageFile",new Blob([bytes],{type:"image/png"}),"uptilldawn-ocr-smoke.png")
 try{
  const response=await fetch("https://api.cloudmersive.com/ocr/photo/toText",{
   method:"POST",
   headers:{Apikey:key,language:"ENG",recognitionMode:"Basic"},
   body:data,
   signal:AbortSignal.timeout(26000),
   cache:"no-store",
  })
  if(!response.ok){
   const reason=response.status===401||response.status===403?"provider_rejected_key":
    response.status===429?"quota_exceeded":response.status===402?"payment_required":"provider_http_error"
   return reply(reason,502,{providerHttpStatus:response.status})
  }
  const len=Number(response.headers.get("content-length")||0)
  if(len>60000)return reply("provider_response_too_large",502)
  const raw=await response.text()
  if(raw.length>60000)return reply("provider_response_too_large",502)
  let result:unknown
  try{result=JSON.parse(raw)}catch{return reply("invalid_provider_response",502)}
  if(!result||typeof result!=="object"||Array.isArray(result))return reply("invalid_provider_response",502)
  const object=result as Record<string,unknown>
  const normalized=typeof object.TextResult==="string"?object.TextResult.toUpperCase().replace(/[^A-Z]/g,""):""
  // Only a boolean and provider status are recorded; the OCR text stays private.
  const matched=normalized.includes("UPTILLDAWN")&&normalized.includes("OCR")&&normalized.includes("TEST")
  return reply(matched?"pass":"text_mismatch",matched?200:422,{
   matched,
   confidence:typeof object.MeanConfidenceLevel==="number"?Math.round(object.MeanConfidenceLevel):null
  })
 }catch{return reply("provider_unavailable",503)}
}

/** Only the signed Deploy main GitHub Actions job may trigger a synthetic
 * Cloudmersive OCR smoke test. No user JWT, webhook secret or app cookie is used.
 * GitHub public signing keys are retrieved from their fixed issuer URL.
 */
const ISSUER="https://token.actions.githubusercontent.com"
const AUDIENCE="uptilldawn-main-ocr-test-v1"
const WORKFLOW="denkyaan/UpTillDawn-Crew/.github/workflows/deploy-main.yml@refs/heads/main"
const JWKS_URL=ISSUER+"/.well-known/jwks"

export function matchesMainDeployClaims(value:unknown,now=Math.floor(Date.now()/1000)):boolean{
 if(!value||typeof value!=="object"||Array.isArray(value))return false
 const c=value as Record<string,unknown>
 return c.iss===ISSUER&&c.aud===AUDIENCE&&
  c.repository==="denkyaan/UpTillDawn-Crew"&&
  c.workflow_ref===WORKFLOW&&
  c.ref==="refs/heads/main"&&c.event_name==="workflow_run"&&
  typeof c.iat==="number"&&c.iat<=now+60&&c.iat>=now-600&&
  typeof c.nbf==="number"&&c.nbf<=now+60&&
  typeof c.exp==="number"&&c.exp>now&&c.exp<=now+600
}

function decodePart(part:string):unknown{
 if(!/^[A-Za-z0-9_-]{2,12000}$/.test(part))return null
 try{
  const json=atob(part.replace(/-/g,"+").replace(/_/g,"/"))
  return JSON.parse(json) as unknown
 }catch{return null}
}

export async function verifyMainDeployOIDC(token:string):Promise<boolean>{
 if(typeof token!=="string"||token.length<100||token.length>12000)return false
 const parts=token.split(".")
 if(parts.length!==3)return false
 const head=decodePart(parts[0])
 const claims=decodePart(parts[1])
 if(!head||typeof head!=="object"||Array.isArray(head)||!matchesMainDeployClaims(claims))return false
 const header=head as Record<string,unknown>
 if(header.alg!=="RS256"||typeof header.kid!=="string"||
   !/^[A-Za-z0-9._-]{5,160}$/.test(header.kid))return false
 try{
  const response=await fetch(JWKS_URL,{
   method:"GET",
   signal:AbortSignal.timeout(8500),
   cache:"no-store",
  })
  if(!response.ok||Number(response.headers.get("content-length")||0)>48000)return false
  const raw=await response.text()
  if(raw.length>48000)return false
  const keys=JSON.parse(raw) as {keys?:Array<Record<string,unknown>>}
  if(!Array.isArray(keys?.keys))return false
  const match=keys.keys.find(k=>k.kid===header.kid&&k.kty==="RSA"&&
    (k.alg===undefined||k.alg==="RS256")&&typeof k.n==="string"&&typeof k.e==="string")
  if(!match)return false
  const key=await crypto.subtle.importKey("jwk",match as JsonWebKey,{
   name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"
  },false,["verify"])
  const data=new TextEncoder().encode(parts[0]+"."+parts[1])
  const sig=Uint8Array.from(atob(parts[2].replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0))
  return await crypto.subtle.verify({name:"RSASSA-PKCS1-v1_5"},key,sig,data)
 }catch{return false}
}

export const MAIN_OCR_TEST_AUDIENCE=AUDIENCE

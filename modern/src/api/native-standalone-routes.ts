// Independent source-equivalent routes: portal switch, public Facebook
// event metadata, and approved-account Geoapify address suggestions.
// Always use the signed Supabase SSR session in native-main-reads.ts, no
// browser-selected roles, service-role key, cross-origin redirects or Next.
import {serializeCookieHeader} from "@supabase/ssr"
import type {SupabaseClient} from "@supabase/supabase-js"
import {userVisiblePortals,type Portal,type PortalAssignment} from "../../../lib/portal-access.ts"
import {fetchFacebookEventInfo} from "../../../lib/facebook-event.ts"
import type {VerifiedIdentity} from "../shared/identity.ts"

const destinations:Record<Portal,string>={
 events:"/",promotion:"/portals/promotion",administration:"/portals/administration"
}
const redirect=(to:string)=>new Response(null,{status:307,headers:{
 Location:to,"Cache-Control":"private, no-store"
}})
const forbidden=()=>Response.json({error:"Geen toegang."},{status:403})

export async function nativePortalSwitchResponse(
 db:SupabaseClient,identity:VerifiedIdentity,request:Request,portal:string
):Promise<Response>{
 if(!Object.hasOwn(destinations,portal))return redirect("/portals")
 // Signed profile.role represents permanent role, never impersonated preview
 // role. DB assignment errors must never grant delegated portals.
 let assigned:PortalAssignment[]=[]
 try{
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(!error&&Array.isArray(data))assigned=data as PortalAssignment[]
 }catch{}
 const allowed=userVisiblePortals(assigned,{
  approved:identity.approved,blocked:identity.account_blocked,
  isOwner:identity.is_owner,
  realIsAdmin:identity.role==="admin",
  role:identity.role
 })
 if(!allowed.includes(portal as Portal))return redirect("/portals")
 const response=redirect(destinations[portal as Portal])
 response.headers.append("Set-Cookie",serializeCookieHeader("uptilldawn-last-portal",portal,{
  path:"/",httpOnly:true,sameSite:"lax",
  secure:new URL(request.url).protocol==="https:",maxAge:60*60*24*90
 }))
 return response
}

/** The original Facebook GET is an Admin-only extraction. Its actual
 * Facebook URL parser has a fixed HTTPS domain allowlist and capped body. */
export async function nativeFacebookEventResponse(
 db:SupabaseClient,identity:VerifiedIdentity,request:Request
):Promise<Response>{
 const [approval,permission]=await Promise.all([
  db.rpc("upt_is_approved"),
  db.rpc("upt_is_admin",{uid:identity.id})
 ])
 if(approval.error||permission.error||approval.data!==true||permission.data!==true)
  return forbidden()
 const url=new URL(request.url).searchParams.get("url")?.trim()||""
 try{return Response.json({event:await fetchFacebookEventInfo(url)})}
 catch(error){return Response.json({
  error:error instanceof Error?error.message:"Facebook-evenement kon niet worden geïmporteerd."
 },{status:422})}
}

type RawLocation={
 place_id?:string;name?:string;formatted?:string;
 address_line1?:string;address_line2?:string;lat?:number;lon?:number;
 result_type?:string;street?:string;housenumber?:string;postcode?:string;
 city?:string;town?:string;village?:string;country_code?:string
}
export function normalizeGeoapifyRow(row:RawLocation,index:number){
 if(typeof row.lat!=="number"||typeof row.lon!=="number"||
  !Number.isFinite(row.lat)||!Number.isFinite(row.lon))return null
 const formatted=row.formatted||[row.address_line1,row.address_line2].filter(Boolean).join(", ")
 if(!formatted)return null
 return {
  id:row.place_id||`${row.lat}:${row.lon}:${index}`,
  name:row.name||row.address_line1||formatted,
  formatted,addressLine1:row.address_line1||row.name||formatted,
  addressLine2:row.address_line2||"",
  latitude:row.lat,longitude:row.lon,
  resultType:row.result_type||"unknown",
  streetAddress:[row.street,row.housenumber].filter(Boolean).join(" ").trim()||row.address_line1||"",
  postalCode:row.postcode||"",city:row.city||row.town||row.village||"",
  countryCode:/^[a-z]{2}$/i.test(row.country_code||"")?row.country_code!.toUpperCase():""
 }
}
const result=(body:unknown,status=200,headers?:HeadersInit)=>
 Response.json(body,{status,headers:{"Cache-Control":"no-store",...headers}})
async function providerResponse(url:string){
 const response=await fetch(url,{headers:{Accept:"application/json"},
  cache:"no-store",signal:AbortSignal.timeout(8000)})
 if(!response.ok)throw Error("Locaties konden niet worden opgezocht.")
 const raw=await response.text()
 // Geoapify returns at most six location objects. Refuse enormous payloads
 // instead of burdening a Cloudflare Free worker.
 if(raw.length>256*1024)throw Error("Locaties konden niet worden opgezocht.")
 const data=JSON.parse(raw) as {results?:RawLocation[]}
 if(!data||!Array.isArray(data.results))return []
 return data.results.slice(0,6).map(normalizeGeoapifyRow).filter(x=>x!==null)
}
export async function nativeGeoapifyAutocompleteResponse(
 db:SupabaseClient,request:Request,key:string
):Promise<Response>{
 // Signed profile approval and the original per-user SQL rate limiter run
 // before we inspect or serve any provider query.
 const {data:approved,error:approvalError}=await db.rpc("upt_is_approved")
 if(approvalError||approved!==true)return forbidden()
 const {data:rate,error:rateError}=await db.rpc("upt_geoapify_rate_limit")
 if(rateError)return result({error:"Locatiezoeker tijdelijk niet beschikbaar."},503)
 const throttle=rate as {allowed?:boolean;retry_after?:number}|null
 if(throttle?.allowed!==true)return result({
  error:"Te veel locatiezoekopdrachten. Probeer over enkele seconden opnieuw."
 },429,{"Retry-After":String(Math.max(1,Number(throttle?.retry_after)||60))})
 const u=new URL(request.url)
 const query=(u.searchParams.get("q")||"").trim()
 const lang=(u.searchParams.get("lang")||"nl").slice(0,2).toLowerCase()
 if(query.length<2)return result({results:[]})
 if(query.length>200)return result({error:"Zoekopdracht is te lang."},400)
 if(!key.trim())return result({error:"Locatiezoeker is nog niet geconfigureerd."},503)
 const params=new URLSearchParams({
  text:query,format:"json",limit:"6",
  lang:["nl","fr","en","de"].includes(lang)?lang:"nl",
  apiKey:key
 })
 try{return result({results:await providerResponse(
  "https://api.geoapify.com/v1/geocode/autocomplete?"+params
 )})}catch(error){
  return result({error:error instanceof Error?error.message:
   "Locaties konden niet worden opgezocht."},502)
 }
}

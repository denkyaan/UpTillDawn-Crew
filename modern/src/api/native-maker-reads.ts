// Original Maker/God Mode read paths extracted from Next. Every request still
// needs the original signed Supabase session, the private God session cookie
// AND upt_god_session_valid. No service-role key, GitHub token or management
// API is available in this Worker.
import {parseCookieHeader} from "@supabase/ssr"
import {z} from "zod"
import type {SupabaseClient} from "@supabase/supabase-js"

export type GodReadPath=
 "/api/god/automation-rules"|"/api/god/preview-role"|"/api/god/rules"|
 "/api/god/data"|"/api/god/error-reports"
export type ReadDb=Pick<SupabaseClient,"rpc"|"from">
const role=new Set(["staff","responsible_lead","admin"])
const studio=(value:unknown,status=200)=>Response.json(value,{status,headers:{
 "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
}})
const failed=()=>studio({error:"De actie kon niet worden voltooid. Vernieuw de status voordat je opnieuw opslaat."},500)
const studioMessage=(text:string,status:number)=>studio({error:text},status)
const unavailable=(status:number)=>Response.json({error:"view_data_unavailable"},{status,headers:{"Cache-Control":"private, no-store"}})
const tokenFrom=(header:string)=>parseCookieHeader(header).find(x=>x.name==="uptilldawn-god-session")?.value||""
export function godRequestCrossSite(request:Request):boolean{
 const site=request.headers.get("sec-fetch-site"),origin=request.headers.get("origin")
 return site==="cross-site"||Boolean(origin&&origin!==new URL(request.url).origin)
}
/** The original Maker studio requires a freshly validated God session on
 * EVERY GET; an authenticated ordinary owner session alone is insufficient. */
export async function makerReadResponse(db:ReadDb,request:Request,cookieHeader:string,path:GodReadPath):Promise<Response>{
 if(godRequestCrossSite(request))return studioMessage("Ongeldige oorsprong.",403)
 const token=tokenFrom(cookieHeader)
 if(!token)return studioMessage("Meld opnieuw aan bij God Mode.",401)
 try{
  const {data:valid,error:sessionError}=await db.rpc("upt_god_session_valid",{p_token:token})
  if(sessionError||valid!==true)return studioMessage("God Mode sessie verlopen.",401)
  const url=new URL(request.url)
  if(path==="/api/god/automation-rules"){
   const {data:owner,error:ownerError}=await db.rpc("upt_current_is_owner")
   if(ownerError||owner!==true)return studioMessage("Alleen de maker kan automatiseringen beheren.",403)
   const {data,error}=await db.from("automation_rules")
    .select("automation_key,label,description,enabled,trigger_key,action_key,delay_minutes,reminder_minutes,escalation_minutes,audience,channels,auto_action,audit_enabled,cooldown_minutes,max_retries,last_run_at,settings")
    .order("automation_key")
   if(error)return failed()
   return studio({rules:data||[]})
  }
  if(path==="/api/god/preview-role"){
   const {data:owner,error:ownerError}=await db.rpc("upt_current_is_owner")
   if(ownerError||owner!==true)return studioMessage("Alleen de maker kan rolvoorbeelden openen.",403)
   const {data,error}=await db.rpc("upt_current_effective_role")
   if(error||!role.has(String(data)))return studioMessage("De actieve voorbeeldrol is niet beschikbaar.",503)
   return studio({role:data})
  }
  if(path==="/api/god/rules"){
   const requested=url.searchParams.get("role")
   if(!requested||!role.has(requested))return studioMessage("Ongeldige rol.",400)
   const {data,error}=await db.rpc("upt_god_role_rules",{p_token:token,p_role:requested})
   if(error)return studioMessage("God Mode sessie is verlopen.",401)
   return studio({rules:data||[]})
  }
  if(path==="/api/god/error-reports"){
   const raw=url.searchParams.get("limit")
   const limit=Math.min(100,Math.max(1,Number(raw||50)||50))
   const {data,error}=await db.rpc("upt_god_error_reports",{p_token:token,p_limit:limit})
   if(error)return failed()
   return studio({reports:Array.isArray(data)?data:[]})
  }
  if(path==="/api/god/data"){
   const table=url.searchParams.get("table")
   const offset=Number(url.searchParams.get("offset")||0)
   if(table&&(!Number.isInteger(offset)||offset<0||offset>100000))return failed()
   const result=table
    ?await db.rpc("upt_god_data_rows",{p_token:token,p_table:table,p_offset:offset})
    :await db.rpc("upt_god_data_catalog",{p_token:token})
   if(result.error)return studioMessage("Gegevens konden niet worden geladen.",400)
   return studio({data:result.data})
  }
  return failed()
 }catch{return failed()}
}
/** Legacy view-data God RPC whitelist; original owner and no-cookie behavior
 * are intentionally different from the authenticated Maker studio GETs. */
export async function godSourceReadResponse(db:ReadDb,cookieHeader:string,args:unknown[]):Promise<Response>{
 try{
  const {data:owner,error:ownerError}=await db.rpc("upt_current_is_owner")
  if(ownerError||owner!==true)return unavailable(403)
  const fn=args[0]
  if(fn!=="upt_god_session_valid"&&fn!=="upt_god_upload_security_audit")return unavailable(400)
  const token=tokenFrom(cookieHeader)
  if(!token)return Response.json({value:{data:fn==="upt_god_session_valid"?false:[],error:null}},{headers:{"Cache-Control":"private, no-store"}})
  const result=fn==="upt_god_session_valid"
   ?await db.rpc(fn,{p_token:token})
   :await db.rpc(fn,{p_token:token,p_limit:200})
  return Response.json({value:{data:result.data,error:result.error?{message:"God Mode-gegevens niet beschikbaar"}:null}},{headers:{"Cache-Control":"private, no-store"}})
 }catch{return unavailable(503)}
}
/** Original user_error_reports RLS single-item lookup, with an independent
 * 'upt_is_approved' gate even for authenticated owners. */
export async function userErrorReportReadResponse(db:ReadDb,request:Request):Promise<Response>{
 if(godRequestCrossSite(request))return Response.json({error:"Ongeldige oorsprong."},{status:403})
 try{
  const {data:approved,error:approvalError}=await db.rpc("upt_is_approved")
  if(approvalError||approved!==true)return Response.json({error:"Aanmelden vereist."},{status:401})
  const id=new URL(request.url).searchParams.get("id")
  if(!id||!z.string().uuid().safeParse(id).success)
   return Response.json({error:"Ongeldig foutrapport."},{status:400})
  const {data,error}=await db.from("user_error_reports")
   .select("id,status,ai_category,ai_severity,ai_summary,ai_user_message,auto_action,maker_action_required,updated_at,resolved_at")
   .eq("id",id).maybeSingle()
  if(error)return Response.json({error:"Foutrapport kon niet worden geladen."},{status:500})
  if(!data)return Response.json({error:"Foutrapport niet gevonden."},{status:404})
  return Response.json({report:data},{headers:{"Cache-Control":"no-store"}})
 }catch{return Response.json({error:"Foutrapport kon niet worden geladen."},{status:500})}
}

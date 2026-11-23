// Original Maker studio role-preview and feature-rule changes without Next.
// Requires signed and active SSR identity, original private God session token,
// upt_god_session_valid, upt_current_is_owner, and QA write gate in worker.ts.
import {z} from "zod"
import {parseCookieHeader} from "@supabase/ssr"
import type {SupabaseClient} from "@supabase/supabase-js"
import {readStrictJson} from "../../../lib/strict-json-body.ts"
import {godRequestCrossSite} from "./native-maker-reads.ts"
const role=z.enum(["staff","responsible_lead","admin"])
const condition=z.enum(["always","assigned_event","assigned_workplace_role","event_active","shift_active","never"])
const rule=z.object({
 role,feature_key:z.string().min(1).max(100),
 label:z.string().max(80),group_key:z.string().max(100),
 visible:z.boolean(),enabled:z.boolean(),
 condition_key:condition,sort_order:z.number().int(),
 settings:z.unknown().optional()
})
const studio=(data:unknown,status=200)=>Response.json(data,{status,headers:{
 "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
}})
const denied=()=>studio({error:"Meld opnieuw aan bij God Mode."},401)
async function makerToken(db:SupabaseClient,request:Request,cookies:string){
 if(godRequestCrossSite(request))return {error:studio({error:"Ongeldige oorsprong."},403)}
 const token=parseCookieHeader(cookies).find(c=>c.name==="uptilldawn-god-session")?.value||""
 if(!token)return {error:denied()}
 try{
  const [session,owner]=await Promise.all([
   db.rpc("upt_god_session_valid",{p_token:token}),
   db.rpc("upt_current_is_owner")
  ])
  if(session.error||session.data!==true)return {error:denied()}
  if(owner.error||owner.data!==true)
   return {error:studio({error:"Alleen de maker kan rolvoorbeelden openen."},403)}
  return {token}
 }catch{return {error:studio({error:"De actie kon niet worden voltooid."},500)}}
}
export async function nativeGodPreviewRolePost(
 db:SupabaseClient,request:Request,cookies:string
):Promise<Response>{
 const auth=await makerToken(db,request,cookies)
 if("error" in auth)return auth.error!
 let body:unknown
 try{body=await readStrictJson(request,8192)}
 catch{return studio({error:"Ongeldige voorbeeldrol."},400)}
 const parsed=z.object({role}).safeParse(body)
 if(!parsed.success)return studio({error:"Ongeldige voorbeeldrol."},400)
 const {data,error}=await db.rpc("upt_set_admin_role_mode",{p_role:parsed.data.role})
 if(error||data!==parsed.data.role)return studio({error:"De voorbeeldrol kon niet worden geactiveerd."},409)
 return studio({ok:true,role:parsed.data.role})
}
export async function nativeGodRulesPost(
 db:SupabaseClient,request:Request,cookies:string
):Promise<Response>{
 const auth=await makerToken(db,request,cookies)
 if("error" in auth)return auth.error!
 let body:unknown
 try{body=await readStrictJson(request,96_000)}
 catch{return studio({error:"Ongeldige editorgegevens."},400)}
 const parsed=z.object({role,rules:z.array(rule).max(60)}).safeParse(body)
 if(!parsed.success)return studio({error:"Ongeldige editorgegevens."},400)
 const normalized=parsed.data.rules.map((item,index)=>({
  ...item,role:parsed.data.role,sort_order:(index+1)*10
 }))
 const {error}=await db.rpc("upt_god_save_role_rules",{
  p_token:auth.token!,p_role:parsed.data.role,p_rules:normalized
 })
 if(error)return studio({error:"God Mode kon de rolregels niet opslaan."},403)
 return studio({ok:true,rules:normalized})
}

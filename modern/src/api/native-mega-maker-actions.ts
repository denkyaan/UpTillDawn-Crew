// Owner workspace switching and God Mode: preserve existing server-managed
// cookie semantics and the independent OWNER role. Public writes remain OFF.
import type {NativeAdminActionDb} from "./native-admin-actions.ts"
import {parseMegaRequest,redirect,failure} from "./native-mega-helpers.ts"
import {boundedMigrationForm} from "../../../lib/migration/bounded-form.ts"
import {decode} from "../../../lib/migration/wire.ts"

export const megaMakerActionIds=[
 "lib/actions/auth.ts#enterNormalAppFromMakerSession",
 "lib/actions/god-mode.ts#enterGodModeFromMakerSession",
 "lib/actions/god-mode.ts#godModeLogout",
 "lib/actions/god-mode.ts#returnToNormalAppFromGodMode",
] as const
export type MegaMakerId=typeof megaMakerActionIds[number]
const ids=new Set<string>(megaMakerActionIds)
export const megaMakerAllowed=(id:string|null):id is MegaMakerId=>typeof id==="string"&&ids.has(id)
export const godLogoutId="lib/actions/god-mode.ts#godModeLogout"
const wsCookie=(id:string,where:string)=>
 "uptilldawn-last-workspace="+encodeURIComponent(id+":"+where)+
 "; Path=/; SameSite=Lax; Secure; Max-Age=7776000"
const godCookie=(token:string)=>
 "uptilldawn-god-session="+encodeURIComponent(token)+
 "; Path=/; SameSite=Strict; Secure; HttpOnly; Max-Age=7200"
const clearGod="uptilldawn-god-session=; Path=/; SameSite=Strict; Secure; HttpOnly; Max-Age=0"
const clearWs="uptilldawn-last-workspace=; Path=/; SameSite=Lax; Secure; Max-Age=0"
function tokenCookie(req:Request){
 const match=(req.headers.get("cookie")||"").split(";")
  .map(part=>part.trim()).find(part=>part.startsWith("uptilldawn-god-session="))
 if(!match)return null
 try{return decodeURIComponent(match.slice("uptilldawn-god-session=".length))}catch{return null}
}
function go(path:string,cookies:string[]){
 const result=redirect(path)
 for(const c of cookies)result.headers.append("Set-Cookie",c)
 return result
}
async function parseUntrustedLogout(req:Request):Promise<boolean>{
 const url=new URL(req.url),site=req.headers.get("sec-fetch-site")
 if(req.headers.get("origin")!==url.origin||(site&&site!=="same-origin"))return false
 if(!(req.headers.get("content-type")||"").startsWith("multipart/form-data;"))return false
 try{
  const form=await boundedMigrationForm(req,64*1024)
  if(form.get("_id")!==godLogoutId)return false
  const raw=form.get("_args")
  if(typeof raw!=="string"||raw.length>1024*1024)return false
  const args=decode(JSON.parse(raw),form)
  return Array.isArray(args)&&args.length===0
 }catch{return false}
}
export async function originalGodLogout(
 req:Request,db:NativeAdminActionDb|null
):Promise<Response>{
 if(!await parseUntrustedLogout(req))return failure(403,"migration_disabled")
 const token=tokenCookie(req)
 if(token&&db)try{await db.rpc("upt_god_logout",{p_token:token})}catch{}
 return go("/login/admin",[clearGod,clearWs])
}
export async function megaMakerResponse(
 req:Request,db:NativeAdminActionDb,selected:MegaMakerId
):Promise<Response>{
 if(selected===godLogoutId)return originalGodLogout(req,db)
 const parsed=await parseMegaRequest(req,db,selected,
  selected==="lib/actions/auth.ts#enterNormalAppFromMakerSession"?0:-1)
 if(!parsed.ok)return parsed.response
 const {actor,fd,db:client}=parsed
 if(!actor.is_owner)return go("/unauthorized",[])
 try{
  const {data:owner,error:ownerError}=await client.rpc("upt_current_is_owner")
  if(ownerError||owner!==true)return go("/unauthorized",[])
  switch(selected){
   case "lib/actions/auth.ts#enterNormalAppFromMakerSession":{
    const portalRaw=String(fd.get("portal")||"admin").toLowerCase()
    const portal=["admin","staff","responsible"].includes(portalRaw)?portalRaw:"admin"
    const role=portal==="admin"?"admin":portal==="responsible"?"responsible_lead":"staff"
    const {data:activated,error}=await client.rpc("upt_set_admin_role_mode",{p_role:role})
    if(error||activated!==role)
     return go("/maker-mode?portal="+portal+"&error=role-mode",[])
    return go(portal==="admin"?"/admin":"/",
     [wsCookie(actor.id,portal==="admin"?"admin":"events")])
   }
   case "lib/actions/god-mode.ts#enterGodModeFromMakerSession":{
    const {data:token,error}=await client.rpc("upt_god_login_owner")
    if(error||typeof token!=="string"||!token)
     return go("/maker-mode?error=god-mode",[])
    return go("/god-mode",[godCookie(token),wsCookie(actor.id,"god-mode")])
   }
   case "lib/actions/god-mode.ts#returnToNormalAppFromGodMode":{
    const {data:role,error}=await client.rpc("upt_set_admin_role_mode",{p_role:"admin"})
    if(error||role!=="admin")
     return go("/maker-mode?portal=admin&error=role-mode",[])
    const token=tokenCookie(req)
    if(token)try{await client.rpc("upt_god_logout",{p_token:token})}catch{}
    return go("/admin",[clearGod,wsCookie(actor.id,"admin")])
   }
  }
  return failure(404,"unknown_action")
 }catch{return failure(422,"action_failed")}
}

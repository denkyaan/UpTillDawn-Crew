// Shared bounded, signed, source-exact action transport. Public writes are
// ALWAYS blocked by worker.ts unless a QA-only private fixture opts in.
import {boundedMigrationForm} from "../../../lib/migration/bounded-form.ts"
import {decode,encode} from "../../../lib/migration/wire.ts"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"

export type AuthContext={
 id:string;role:string;approved:boolean;account_blocked:boolean;
 is_owner:boolean;effective_role:string|null
}
export type MegaDb=NativeAdminActionDb & {
 from:(name:string)=>any
 storage:{from:(name:string)=>any}
}
export const failure=(status:number,code:string)=>Response.json({
 error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code
},{status,headers:{"Cache-Control":"private, no-store"}})
export const done=(result:unknown=undefined)=>Response.json({
 value:encode(result,new FormData()),refresh:true
},{headers:{"Cache-Control":"private, no-store"}})
export const redirect=(to:string)=>Response.json({redirect:to},{
 headers:{"Cache-Control":"private, no-store"}
})
export const uuid=(id:unknown):string=>{
 const value=String(id||"")
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
  throw Error("Invalid UUID")
 return value
}
export const option=(fd:FormData,key:string,max:number)=>
 String(fd.get(key)||"").trim().slice(0,max)||undefined
export async function parseMegaRequest(
 req:Request,db:NativeAdminActionDb,id:string,
 formIndex:0|1|-1=0
):Promise<{ok:true;fd:FormData;actor:AuthContext;db:MegaDb}|{ok:false;response:Response}>{
 const url=new URL(req.url),site=req.headers.get("sec-fetch-site")
 if(req.headers.get("origin")!==url.origin||(site&&site!=="same-origin"))
  return {ok:false,response:failure(403,"migration_disabled")}
 if(!(req.headers.get("content-type")||"").startsWith("multipart/form-data;"))
  return {ok:false,response:failure(415,"invalid_content_type")}
 let body:FormData
 try{body=await boundedMigrationForm(req,64*1024)}
 catch{return {ok:false,response:failure(413,"invalid_form")}}
 if(body.get("_id")!==id)return {ok:false,response:failure(404,"unknown_action")}
 const raw=body.get("_args")
 if(typeof raw!=="string"||raw.length>1024*1024)
  return {ok:false,response:failure(413,"invalid_arguments")}
 let args:unknown
 try{args=decode(JSON.parse(raw),body)}
 catch{return {ok:false,response:failure(400,"invalid_arguments")}}
 if(!Array.isArray(args)||args.length!==formIndex+1||
    (formIndex>=0&&!(args[formIndex] instanceof FormData)))
  return {ok:false,response:failure(400,"invalid_arguments")}
 try{
  const {data:{user},error}=await db.auth.getUser()
  if(error||!user)return {ok:false,response:failure(401,"authentication_required")}
  const {data:records,error:contextError}=await db.rpc("upt_current_session_context")
  const actor=Array.isArray(records)?records[0] as AuthContext|null:null
  if(contextError||!actor||actor.id!==user.id||
   (!actor.approved&&!actor.is_owner)||(actor.account_blocked&&!actor.is_owner))
   return {ok:false,response:failure(422,"action_failed")}
  return {ok:true,fd:formIndex>=0?args[formIndex] as FormData:new FormData(),
   actor,db:db as MegaDb}
 }catch{return {ok:false,response:failure(422,"action_failed")}}
}
export const hasAdminRole=(a:AuthContext)=>
 (a.role==="admin"||a.is_owner)&&(a.approved||a.is_owner)&&(!a.account_blocked||a.is_owner)
export const approvedAdmin=async(db:MegaDb,a:AuthContext)=>{
 if(!hasAdminRole(a))return false
 const {data:allowed,error}=await db.rpc("upt_is_admin",{uid:a.id})
 return !error&&allowed===true
}

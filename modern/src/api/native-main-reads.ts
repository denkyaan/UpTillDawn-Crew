// Original Main read-only endpoints extracted without Next SSR.
// Keep the original cookie session format and the signed PostgREST/RLS
// upt_current_session_context check. A cookie alone is NOT authorization.
import {createServerClient,parseCookieHeader,serializeCookieHeader} from "@supabase/ssr"
import {isActive,parseIdentity,type VerifiedIdentity} from "../shared/identity.ts"

import {runtimeForRequest,type RuntimeEnvironment} from "./runtime-scope.ts"
type Environment=RuntimeEnvironment&{SUPABASE_ANON_KEY:string}
type Db=ReturnType<typeof createServerClient>
type Authorized={ok:true;db:Db;identity:VerifiedIdentity;cookieHeader:string;setCookies:string[]}
type Denied={ok:false;status:401|503}
export type SourceReadSession=Authorized|Denied
const authCookie=/^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i

// Use exactly the browser/legacy Supabase SSR cookie chunks. Never treat the
// PKCE verifier or a user-provided role as proof of login.
export function hasOriginalAuthCookie(raw:string):boolean{
 return parseCookieHeader(raw).some(c=>authCookie.test(c.name)&&Boolean(c.value))
}

export async function sourceReadSession(request:Request,env:Environment):Promise<SourceReadSession>{
 if(!runtimeForRequest(request.url,env)||
    !env.SUPABASE_ANON_KEY?.startsWith("sb_publishable_"))return {ok:false,status:503}
 const cookieHeader=request.headers.get("cookie")||""
 const project=new URL(env.SUPABASE_URL).hostname.split(".")[0]
 const sessionName="sb-"+project+"-auth-token"
 if(!parseCookieHeader(cookieHeader).some(c=>(c.name===sessionName||c.name.startsWith(sessionName+".")&&/^\d+$/.test(c.name.slice(sessionName.length+1)))&&Boolean(c.value)))return {ok:false,status:401}
 const jar=new Map(parseCookieHeader(cookieHeader).map(c=>[c.name,c.value??""]))
 const setCookies:string[]=[]
 try{
  const db=createServerClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,{
   cookies:{
    getAll:()=>Array.from(jar,([name,value])=>({name,value})),
    setAll:changes=>{
     for(const {name,value,options} of changes){
      jar.set(name,value)
      setCookies.push(serializeCookieHeader(name,value,options))
     }
    }
   }
  })
  // Server-signed identity and user-scoped RLS, identical to getCurrentUser()
  // on the original Main. No service-role key or client-supplied identity.
  const {data,error}=await db.rpc("upt_current_session_context")
  const identity=parseIdentity(Array.isArray(data)?data[0]:null)
  if(error||!identity||!isActive(identity))return {ok:false,status:401}
  return {ok:true,db,identity,cookieHeader,setCookies}
 }catch{return {ok:false,status:503}}
}

export function attachSourceCookies(response:Response,session:Authorized):Response{
 for(const cookie of session.setCookies)response.headers.append("Set-Cookie",cookie)
 return response
}

export async function pushConfigResponse(db:Db):Promise<Response>{
 try{
  // Preserve the exact source response fields and its existing partial-error
  // behavior: unread badge failures do not break configured push.
  const [{data:publicKey,error:keyError},{data:unreadCount}]=await Promise.all([
   db.rpc("upt_push_public_key"),
   db.rpc("upt_notification_badge_count")
  ])
  if(keyError||!publicKey)
   return Response.json({error:"Push is nog niet geconfigureerd."},{status:503})
  return Response.json({publicKey,unreadCount:unreadCount??0},{headers:{"Cache-Control":"no-store"}})
 }catch{return Response.json({error:"Push is nog niet geconfigureerd."},{status:503})}
}

export function portalPreferenceResponse(cookieHeader:string):Response{
 const last=parseCookieHeader(cookieHeader).find(c=>c.name==="uptilldawn-last-portal")?.value
 const lastPortal=last==="events"||last==="promotion"||last==="administration"?last:null
 return Response.json({value:{lastPortal}},{headers:{"Cache-Control":"private, no-store"}})
}
